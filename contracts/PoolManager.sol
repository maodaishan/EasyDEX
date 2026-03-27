// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./interfaces/IPoolManager.sol";
import "./interfaces/IEasyToken.sol";
import "./Pool.sol";
import "./utils/SimplePriceHelper.sol";
import "./ELFToken.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PoolManager is Ownable, IPoolManager {
    uint8 private constant DEFAULT_ELF_PRICE_DECIMAL = 8;

    struct PoolAddr {
        address poolAddr;
        address tokenAddr;
    }

    struct Fee {
        uint8 decimal;
        uint24 fee;
    }

    struct Price {
        uint price;
        uint8 decimal;
    }

    Fee public fee;
    address public ELFAddress;
    address public EASYAddress;
    PoolAddr[] public pools;
    SimplePriceHelper public priceHelper;

    // Events
    event PoolAdded(address indexed tokenAddr, address indexed poolAddr, uint256 settings);
    event PoolSettingsUpdated(address indexed poolAddr, uint256 newSettings);

    constructor(
        address _priceHelper,
        address _ELFAddress,
        address _EASYAddress
    ) Ownable(msg.sender) {
        priceHelper = SimplePriceHelper(_priceHelper);
        ELFAddress = _ELFAddress;
        EASYAddress = _EASYAddress;
        
        // Set default fee: 0.1% (10 basis points)
        fee.fee = 10;
        fee.decimal = 4;
    }

    /// @inheritdoc IPoolManager
    function addPool(
        address tokenAddr,
        uint256 settings
    ) external onlyOwner returns (address newPool) {
        require(tokenAddr != address(0), "Invalid token address");
        
        // Check if pool already exists
        for(uint i = 0; i < pools.length; i++){
            require(pools[i].tokenAddr != tokenAddr, "Pool already exists");
        }
        
        newPool = address(new Pool(tokenAddr, settings));
        pools.push(PoolAddr(newPool, tokenAddr));
        
        emit PoolAdded(tokenAddr, newPool, settings);
    }

    /// @inheritdoc IPoolManager
    function updatePoolSettings(
        address pool,
        uint256 newSettings
    ) external onlyOwner returns (bool success) {
        for(uint i = 0; i < pools.length; i++){
            if(pools[i].poolAddr == pool){
                success = IPool(pools[i].poolAddr).updateSettings(newSettings);
                if(success) {
                    emit PoolSettingsUpdated(pool, newSettings);
                }
                return success;
            }
        }
        return false;
    }

    /// @inheritdoc IPoolManager
    function updateFee(uint24 newFee, uint8 newDecimal) external onlyOwner {
        require(newFee <= 10000, "Fee too high"); // Max 100%
        require(newDecimal <= 6, "Decimal too high");
        
        Fee memory oldFee = fee;
        fee.fee = newFee;
        fee.decimal = newDecimal;
        emit FeeUpdated(oldFee.fee, oldFee.decimal, newFee, newDecimal);
    }

    /// @inheritdoc IPoolManager
    function getELFPrice() external view returns (uint price, uint8 decimal) {
        uint256 tvl = this.getTVL();
        uint256 supply = IERC20(ELFAddress).totalSupply();
        
        if(supply == 0) {
            return (1 * 10**DEFAULT_ELF_PRICE_DECIMAL, DEFAULT_ELF_PRICE_DECIMAL); // Initial price: $1
        }
        
        tvl = MathUtils.convertDecimal(tvl, DEFAULT_ELF_PRICE_DECIMAL, 0);
        price = tvl / supply;
        return (price, DEFAULT_ELF_PRICE_DECIMAL);
    }

    /// @inheritdoc IPoolManager
    function getTVL() external view returns (uint256 tvl) {
        if(pools.length == 0) return 0;
        
        uint256 totalValue = 0;
        
        for(uint i = 0; i < pools.length; i++){
            PoolAddr memory p = pools[i];
            
            try priceHelper.getPrice(p.tokenAddr) returns (uint256 tokenPrice, uint8 tokenDecimal) {
                uint256 poolLiquidity = Pool(p.poolAddr).liquidity();
                if(poolLiquidity > 0) {
                    uint256 poolValue = poolLiquidity * tokenPrice;
                    
                    // Get token decimals
                    uint8 tokenDecimals = 18; // Default
                    try ERC20(p.tokenAddr).decimals() returns (uint8 decimals) {
                        tokenDecimals = decimals;
                    } catch {}
                    
                    // Convert to USD (decimal = 0)
                    poolValue = MathUtils.convertDecimal(poolValue, 0, tokenDecimals + tokenDecimal);
                    totalValue += poolValue;
                }
            } catch {
                // Skip pools with price feed issues
                continue;
            }
        }
        
        return totalValue;
    }

    function getPool(address token) internal view returns(address) {
        for(uint i = 0; i < pools.length; i++){
            if(pools[i].tokenAddr == token){
                return pools[i].poolAddr;
            }
        }
        revert("Token not supported");
    }

    /// @inheritdoc IPoolManager
    function addLiquidity(
        address tokenAddr,
        uint256 liquidity
    ) external payable {
        require(liquidity > 0, "Invalid liquidity amount");
        address pool = getPool(tokenAddr);

        // Get current ELF price before adding liquidity
        (uint elfPrice, uint8 elfPriceDecimal) = this.getELFPrice();
        
        // Transfer tokens to pool and add liquidity
        IPool(pool).addLiquidity{value: msg.value}(msg.sender, liquidity);
        
        // Calculate token value in USD
        (uint tokenPrice, uint8 tokenDecimal) = priceHelper.getPrice(tokenAddr);
        uint256 tokenValue = liquidity * tokenPrice;
        
        // Get token decimals for proper calculation
        uint8 tokenDecimals = 18; // Default
        try ERC20(tokenAddr).decimals() returns (uint8 decimals) {
            tokenDecimals = decimals;
        } catch {}
        
        // Convert to ELF price decimal for calculation
        tokenValue = MathUtils.convertDecimal(tokenValue, elfPriceDecimal, tokenDecimals + tokenDecimal);
        
        // Calculate ELF amount to mint
        uint256 elfAmount = tokenValue / elfPrice;
        
        // Convert to ELF token decimals
        uint8 elfTokenDecimal = ERC20(ELFAddress).decimals();
        if(elfTokenDecimal != elfPriceDecimal){
            elfAmount = MathUtils.convertDecimal(elfAmount, elfTokenDecimal, elfPriceDecimal);
        }
        
        // Mint ELF tokens to LP
        ELFToken(ELFAddress).mint(msg.sender, elfAmount);
        
        // Mint EASY tokens based on TVL
        uint256 usdValue = MathUtils.convertDecimal(tokenValue, 0, elfPriceDecimal);
        IEasyToken(EASYAddress).onAddLiquidity(msg.sender, usdValue);
        
        emit LiquidityAdded(pool, msg.sender, liquidity, elfAmount);
    }

    /// @inheritdoc IPoolManager
    function removeLiquidity(address receiveToken) external {
        address pool = getPool(receiveToken);
        
        uint256 elfAmount = ELFToken(ELFAddress).balanceOf(msg.sender);
        require(elfAmount > 0, 'No ELF tokens to redeem');
        
        // Calculate token amount to withdraw
        (uint elfPrice, uint8 elfPriceDecimal) = this.getELFPrice();
        uint256 tokenValue = elfAmount * elfPrice;
        
        (uint tokenPrice, uint8 tokenDecimal) = priceHelper.getPrice(receiveToken);
        
        // Convert value to token price decimal
        if(elfPriceDecimal != tokenDecimal){
            tokenValue = MathUtils.convertDecimal(tokenValue, tokenDecimal, elfPriceDecimal);
        }
        
        uint256 tokenAmount = tokenValue / tokenPrice;
        
        // Convert to token decimals
        uint8 tokenDecimals = 18; // Default
        try ERC20(receiveToken).decimals() returns (uint8 decimals) {
            tokenDecimals = decimals;
        } catch {}
        
        tokenAmount = MathUtils.convertDecimal(tokenAmount, tokenDecimals, tokenDecimal);
        
        // Remove liquidity from pool (adds to pending withdrawals)
        IPool(pool).removeLiquidity(msg.sender, tokenAmount);
        
        // Burn ELF tokens
        ELFToken(ELFAddress).burnFrom(msg.sender, elfAmount);
        
        emit LiquidityRemoved(pool, msg.sender, tokenAmount, elfAmount);
    }

    /// @inheritdoc IPoolManager
    function swap(
        address inToken,
        uint256 inAmount,
        address outToken
    ) external payable {
        require(inAmount > 0, 'Invalid swap amount');
        require(inToken != outToken, 'Cannot swap same token');
        
        address inPool = getPool(inToken);
        address outPool = getPool(outToken);
        
        // Get prices
        (uint inTokenPrice, uint8 inTokenDecimal) = priceHelper.getPrice(inToken);
        (uint outTokenPrice, uint8 outTokenDecimal) = priceHelper.getPrice(outToken);
        
        // Prepare slippage calculation parameters
        IPool.EstimateSlippageInput memory params;
        params.inPoolValue = IPool(inPool).getPoolValue(inTokenPrice, inTokenDecimal);
        params.inPrice = inTokenPrice;
        params.inAmount = inAmount;
        params.inDecimal = inTokenDecimal;
        params.price = outTokenPrice;
        params.decimal = outTokenDecimal;
        
        // Calculate slippage
        (uint slippageRatio, uint8 slippageDecimal) = IPool(outPool).estimateSlippage(params);
        
        // Calculate exchange rate with slippage
        uint256 baseRate = (inTokenPrice * 10**outTokenDecimal) / outTokenPrice;
        uint256 slippageAmount = (baseRate * slippageRatio) / (10**slippageDecimal);
        uint256 actualRate = baseRate + slippageAmount;
        
        // Calculate output amount
        uint256 outAmount = (inAmount * actualRate) / (10**outTokenDecimal);
        
        // Apply trading fee
        uint256 feeAmount = (outAmount * fee.fee) / (10**fee.decimal);
        outAmount = outAmount - feeAmount;
        
        // Execute the swap
        IPool(inPool).addLiquidity{value: msg.value}(msg.sender, inAmount);
        IPool(outPool).removeLiquidity(msg.sender, outAmount);
        
        // Mint EASY tokens for trading activity
        uint256 swapValueUSD = MathUtils.convertDecimal(
            inAmount * inTokenPrice, 
            0, 
            inTokenDecimal + 18 // Assuming 18 decimals for token amount
        );
        IEasyToken(EASYAddress).onSwap(msg.sender, swapValueUSD);
        
        emit Swap(msg.sender, inToken, inAmount, outToken, outAmount);
    }

    // View functions for transparency
    function getPoolCount() external view returns (uint256) {
        return pools.length;
    }
    
    function getPoolInfo(uint256 index) external view returns (address poolAddr, address tokenAddr) {
        require(index < pools.length, "Index out of bounds");
        PoolAddr memory pool = pools[index];
        return (pool.poolAddr, pool.tokenAddr);
    }
    
    function getFeeInfo() external view returns (uint24 feeRate, uint8 feeDecimal) {
        return (fee.fee, fee.decimal);
    }
    
    function isTokenSupported(address token) external view returns (bool) {
        for(uint i = 0; i < pools.length; i++){
            if(pools[i].tokenAddr == token){
                return true;
            }
        }
        return false;
    }
}