// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IPool.sol";
import "./utils/ERC20Helper.sol";
import "./utils/Common.sol";
import "./utils/MathUtils.sol";

contract Pool is Ownable, IPool {
    /// @notice below are constant setting masks. they were all saved in a single slot.
    //0-3 , 4 bytes for the gate of slippage mode
    //4,    1 byte for the price range ratio of supplying the liquidity in pool mode.
    //5-19, 15 bytes for target slippages under 3 ranges of liquidity.
    //20-31, 12 bytes for the influence of pool ratios to slippage.

    /// @notice Gate of the slippage mode.(pool mode or settings mode).
    /// if liquidity is over this gate, will use pool liquidity
    /// to calculate slippage.
    /// else use the defined settings.
    uint256 public constant LQ_GATE_MASK = 0xFFFFFFFF;

    /// @notice in pool mode, the price range to supply liquidity
    /// it's percentage of the oracle price. e.g. oracle price is 1000,
    /// this settings is "150", means the pool will supply liquidity in
    /// "1000-2500".
    uint256 public constant LQ_TARGET_PRICE_RANGE = 0xFF << 32;

    /// @notice Target of slippages.
    /// 3 stages.every stage has 4 bytes for edge(uint32) and 1 byte for the
    /// target slippage from right to left, is higher to lower,begin from 0.
    /// e.g.  0xFFFFFFFF  0A  004C4B40  05    0007A120  00
    ///       very large  10   5000000   5      500000   0
    /// means the pool liquidity (by USD):
    /// 0       <= liquidity < 500000 ,   target slippage = 0
    /// 500000  <= liquidity < 5000000,   target slippage = 5%
    /// 5000000 <= liquidity              target slippage  = 10%
    uint256 public constant SETTINGS_TARGET_SLIPPAGES = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF << 40;
    uint256 private constant TARGET_SLIPPAGES_SINGLE_MASK = 0xFFFFFFFFFF;
    uint256 private constant SINGLE_TARGET_SETTINGS_LENGTH = 40;

    /// @notice influence of pools ratio.EstimateSlippageInput
    /// 3 stages, every stage has 2 bytes for edge(fixed8x8) and 2 bytes for
    /// target ratio to slippage (fixed8x8)
    uint256 public constant SETTINGS_POOL_RATIO_SLIPPAGES = 0xFFFFFFFFFFFFFFFFFFFFFFFF << 160;

    /// @notice default decimal of the final slippage result
    uint8 private constant SLIPPAGE_DEFAULT_DECIMAL = 4;

    uint256 public settings;
    address public tokenAddress;
    uint256 public liquidity;   //Be aware we should use liquidity,not this.balance to get liquidity, because maybe LP
                                //removed liquidity but not withdraw.
    address private managerAddress;
    mapping(address => uint256) private pendingWithdraw;

    constructor(
        address token,
        uint256 inputSettings
    ) Ownable(msg.sender) {
        settings = inputSettings;
        tokenAddress = token;
        managerAddress = msg.sender;
        //liquidity=0;  initial value is 0
    }

    modifier onlyManager() {
        require(msg.sender == managerAddress, "Only manager can call this function");
        _;
    }

    /// @inheritdoc IPool
    function updateSettings(
        uint256 newSettings
    ) public onlyOwner returns (bool){
        require(checkSettings(newSettings) == true, "Invalid settings");
        uint256 oldSettings = settings;
        settings = newSettings;
        emit settingsUpdated(address(this), oldSettings, newSettings);
        return true;
    }

    function checkSettings(
        uint256 newSettings
    ) internal pure returns (bool){
        // Basic validation - ensure gate threshold is reasonable
        uint256 gate = newSettings & LQ_GATE_MASK;
        require(gate > 0, "Gate threshold must be positive");
        
        // Validate slippage targets are in reasonable range (0-100%)
        uint128 slippageTargets = uint128((newSettings & SETTINGS_TARGET_SLIPPAGES) >> 40);
        for(uint8 i = 0; i < 3; i++){
            uint32 singleTargetSetting = uint32(slippageTargets & TARGET_SLIPPAGES_SINGLE_MASK);
            uint8 ratio = uint8(singleTargetSetting & 0xFF);
            require(ratio <= 100, "Slippage ratio cannot exceed 100%");
            slippageTargets = slippageTargets >> SINGLE_TARGET_SETTINGS_LENGTH;
        }
        
        return true;
    }

    function addLiquidity(
        address user,
        uint256 amount
    ) external payable onlyManager returns(uint256){
        bool isETH = Common.isETH(tokenAddress);
        uint256 oldLiquidity = liquidity;
        
        if(isETH){
            require(amount == msg.value, 'ETH value not match amount');
            liquidity += msg.value;
            require(address(this).balance >= liquidity, 'ETH balance not match');
        } else {
            uint256 allowance = IERC20(tokenAddress).allowance(user, address(this));
            require(allowance >= amount, 'Not enough allowance for transfer');
            ERC20Helper.safeTransferFrom(tokenAddress, user, address(this), amount);
            
            (bool success, uint256 newBalance) = ERC20Helper.tryGetERC20Balance(tokenAddress, address(this));
            require(success, 'Failed to get ERC20 balance');
            liquidity += amount;
            require(newBalance >= liquidity, 'ERC20 balance not match');
        }
        
        emit liquidityUpdated(address(this), oldLiquidity, liquidity);
        return liquidity;
    }

    function removeLiquidity(
        address user,
        uint256 amount
    ) external onlyManager returns (uint256){
        require(amount <= liquidity, 'Not enough liquidity in pool');
        
        uint256 oldLiquidity = liquidity;
        liquidity -= amount;
        pendingWithdraw[user] += amount;
        
        emit liquidityUpdated(address(this), oldLiquidity, liquidity);
        return liquidity;
    }

    /// @inheritdoc IPool
    function withdraw() public {
        uint256 amount = pendingWithdraw[msg.sender];
        require(amount > 0, 'Nothing to withdraw');
        pendingWithdraw[msg.sender] = 0;
        
        bool isETH = Common.isETH(tokenAddress);
        if(isETH){
            ERC20Helper.safeTransferETH(msg.sender, amount);
        } else {
            ERC20Helper.safeTransfer(tokenAddress, msg.sender, amount);
        }
    }

    /// @inheritdoc IPool
    function estimateSlippage(
        EstimateSlippageInput memory params
    ) external view returns(uint, uint8){
        uint256 poolValue = params.price * liquidity;
        poolValue = MathUtils.convertDecimal(poolValue, 0, params.decimal);

        // Judge the slippage mode
        // if poolValue > gate, poolMode, else settingMode
        uint256 gate = settings & LQ_GATE_MASK;
        bool usePoolMode = poolValue >= gate;
        
        if(usePoolMode){
            return estimateSlippageByPoolMode(params.inPrice, params.inAmount, params.inDecimal, params.price, params.decimal);
        }

        // Settings mode - calculate slippage using preset parameters
        
        // Get T (target slippage ratio)
        uint128 slippageTargets = uint128((settings & SETTINGS_TARGET_SLIPPAGES) >> 40);
        uint32 low = 0;
        uint32 high = 0;
        uint8 T = 0; // target Ratio, decimal of T is 2
        
        for(uint8 i = 0; i < 3; i++){
            uint32 singleTargetSetting = uint32(slippageTargets & TARGET_SLIPPAGES_SINGLE_MASK);
            (high, T) = getSingleTargetSetting(singleTargetSetting);
            
            if(poolValue >= low && poolValue < high){
                break;
            } else {
                low = high;
                slippageTargets = slippageTargets >> SINGLE_TARGET_SETTINGS_LENGTH;
            }
        }

        // Calculate R (ratio of swap amount to pool liquidity)
        uint256 inValue = params.inPrice * params.inAmount;
        inValue = MathUtils.convertDecimal(inValue, SLIPPAGE_DEFAULT_DECIMAL, params.inDecimal);
        uint256 R = poolValue > 0 ? inValue / poolValue : 0;
        
        if(R == 0){
            return (0, 0);
        }

        // Calculate X (pool ratio influence)
        uint256 X = params.inPoolValue > 0 ? params.inPoolValue / poolValue : 10**SLIPPAGE_DEFAULT_DECIMAL; // Default to 1.0
        if(X == 0) X = 10**SLIPPAGE_DEFAULT_DECIMAL; // Ensure X is at least 1.0

        // Final slippage calculation: slippage = T * R * X
        uint256 T2 = MathUtils.convertDecimal(uint256(T), SLIPPAGE_DEFAULT_DECIMAL, 2);
        uint256 finalSlippage = (T2 * R * X) / (10**(SLIPPAGE_DEFAULT_DECIMAL * 2));
        
        return (finalSlippage, SLIPPAGE_DEFAULT_DECIMAL);
    }

    function getSingleTargetSetting(
        uint32 slippageTargets
    ) private pure returns (uint32 high, uint8 ratio){
        ratio = uint8(slippageTargets & 0xFF);
        high = (slippageTargets >> 8);
    }

    function estimateSlippageByPoolMode(
        uint inPrice,
        uint256 inAmount,
        uint8 inDecimal,
        uint price,
        uint8 decimal
    ) private view returns (uint, uint8){
        // Implement Uniswap V3 style slippage calculation
        // For now, return a basic calculation based on price impact
        
        uint256 poolValueUSD = price * liquidity;
        poolValueUSD = MathUtils.convertDecimal(poolValueUSD, 0, decimal);
        
        uint256 swapValueUSD = inPrice * inAmount;
        swapValueUSD = MathUtils.convertDecimal(swapValueUSD, 0, inDecimal);
        
        // Basic price impact calculation: impact = (swapValue / poolValue)^2
        if(poolValueUSD == 0) return (0, 0);
        
        uint256 impact = (swapValueUSD * swapValueUSD) / poolValueUSD;
        impact = MathUtils.convertDecimal(impact, SLIPPAGE_DEFAULT_DECIMAL, 0);
        
        // Cap maximum slippage at 50%
        uint256 maxSlippage = 50 * 10**SLIPPAGE_DEFAULT_DECIMAL / 100;
        if(impact > maxSlippage) impact = maxSlippage;
        
        return (impact, SLIPPAGE_DEFAULT_DECIMAL);
    }

    function getPoolValue(
        uint price,
        uint8 decimal
    ) external view returns (uint256 value){
        value = price * liquidity;
        value = MathUtils.convertDecimal(value, 0, decimal);
    }
    
    // Getter functions for testing and transparency
    function getPendingWithdraw(address user) external view returns (uint256) {
        return pendingWithdraw[user];
    }
    
    function getManagerAddress() external view returns (address) {
        return managerAddress;
    }
}