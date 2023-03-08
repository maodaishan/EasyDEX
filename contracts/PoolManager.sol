// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./interfaces/IPoolManager.sol";
import "./interfaces/IEasyToken.sol";
import "./Pool.sol";
import "./utils/PriceHelper.sol";
import "./ELFToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract PoolManager is IPoolManager,PriceHelper,Ownable{
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

    Fee fee;
    address ELFAddress;
    address EASYAddress;
    PoolAddr[] pools;

    constructor(
        address _oracleRegister,
        address _ELFAddress,
        address _EASYAddress
    ) PriceHelper(_oracleRegister){
        //remember in js,call grantRole to permit PoolManager mint/burn ELF token.
        ELFAddress = _ELFAddress;
        EASYAddress = _EASYAddress;
        IEasyToken(EASYAddress).setPoolManager(address(this));
    }

    function addPool(
        address tokenAddr,
        uint256 settings
    ) external
    onlyOwner
    returns (address newPool){
        newPool = address(new Pool(tokenAddr,settings));
        pools.push(PoolAddr(newPool, tokenAddr));
    }

    function updatePoolSettings(
        address pool,
        uint256 newSettings
    ) external
    onlyOwner
    returns (bool success){
        PoolAddr storage p;
        for(uint i = 0; i < pools.length; i++){
            p = pools[i];
            if(p.poolAddr == pool){
                return IPool(p.poolAddr).updateSettings(newSettings);
            }
        }
        return false;
    }

    function updateFee(uint24 newFee, uint8 newDecimal)  external onlyOwner {
        Fee memory oldFee = fee;
        fee.fee = newFee;
        fee.decimal = newDecimal;
        emit FeeUpdated(oldFee.fee, oldFee.decimal, newFee, newDecimal);
    }

    function getELFPrice() external view returns (uint price,uint8 decimal){
        uint256 tvl = this.getTVL();
        uint256 supply = IERC20(ELFAddress).totalSupply();
        tvl = MathUtils.convertDecimal(tvl, DEFAULT_ELF_PRICE_DECIMAL, 0);
        price = tvl/supply;
        return (price,DEFAULT_ELF_PRICE_DECIMAL);
    }

    function getTVL() external view returns (uint256 tvl){
        uint256 totalValue = 0;
        PoolAddr storage p;
        uint8 decimal=0;
        for(uint i = 0; i < pools.length; i++){
            p = pools[i];
            //TODO: test decimal,consider the influence to price.
            (uint t_price,uint8 t_decimal) = getPrice(p.tokenAddr);
            //all token use the 1st's decimal
            if(decimal == 0){
                decimal = t_decimal;
            }
            if(decimal != t_decimal){
                t_price = MathUtils.convertDecimal(t_price, decimal, t_decimal);
            }
            uint256 amount = Pool(p.poolAddr).liquidity();
            uint256 poolValue = amount*t_price;
            uint8 tokenDecimal = ERC20(p.tokenAddr).decimals();
            poolValue = MathUtils.convertDecimal(poolValue, 0, tokenDecimal + t_decimal);
            require(poolValue > 0,'invalid poolValue');
            totalValue += poolValue;
        }
        require(totalValue > 0,'invalid totalValue');
        return totalValue;
    }

    function getPool(address token) internal view returns(address){
        for(uint i = 0; i < pools.length; i++){
            PoolAddr storage p = pools[i];
            if(p.tokenAddr == token){
                return p.poolAddr;
            }
        }
        revert("not supported token");
    }

    function addLiquidity(
        address tokenAddr,
        uint256 liquidity
    ) external payable{
        require(liquidity > 0,'invalid liquidity');
        address pool = getPool(tokenAddr);

        //this will transfer token from msg.sender to pool.
        IPool(pool).addLiquidity{value:msg.value}(msg.sender,liquidity);
        (uint tokenPrice, uint8 tokenDecimal) = getPrice(tokenAddr);
        (uint elfPrice, uint8 elfPriceDecimal) = this.getELFPrice();
        uint256 tokenValue = liquidity * tokenPrice;
        if(tokenDecimal != elfPriceDecimal){
            tokenValue = MathUtils.convertDecimal(tokenValue,elfPriceDecimal,tokenDecimal);
        }
        uint256 elfAmount = tokenValue / elfPrice;
        uint8 elfTokenDecimal = ERC20(ELFAddress).decimals();
        if(elfTokenDecimal != elfPriceDecimal){
            elfAmount = MathUtils.convertDecimal(elfAmount,elfTokenDecimal,elfPriceDecimal);
        }
        ELFToken(ELFAddress).mint(msg.sender,elfAmount);
        //Will mint EASY to msg.sender according the liquidity value
        tokenValue = MathUtils.convertDecimal(tokenValue, 0, elfPriceDecimal);
        IEasyToken(EASYAddress).onAddLiquidity(msg.sender, tokenValue);
        emit LiquidityAdded(pool,msg.sender,liquidity,elfAmount);
    }

    function removeLiquidity(address receiveToken) external{
        address pool = getPool(receiveToken);

        uint256 elfAmount = ELFToken(ELFAddress).balanceOf(msg.sender);
        require(elfAmount > 0,'nothing to remove');

        (uint elfPrice, uint8 elfPriceDecimal) = this.getELFPrice();
        uint256 tokenValue = elfAmount*elfPrice;
        (uint tokenPrice, uint8 tokenDecimal) = getPrice(receiveToken);
        if(elfPriceDecimal != tokenDecimal){
            tokenValue = MathUtils.convertDecimal(tokenValue,tokenDecimal,elfPriceDecimal);
        }
        uint256 tokenAmount = tokenValue/tokenPrice;

        IPool(pool).removeLiquidity(msg.sender,tokenAmount);
        ELFToken(ELFAddress).burn(elfAmount);

        emit LiquidityRemoved(pool,msg.sender,tokenAmount,elfAmount);
    }

    function swap(
        address inToken,
        uint256 inAmount,
        address outToken
    ) external payable{
        address inPool = getPool(inToken);
        address outPool = getPool(outToken);
        require(inAmount > 0,'nothing to swap');

        Price memory inTokenPrice;
        Price memory outTokenPrice;
        (inTokenPrice.price,inTokenPrice.decimal) = getPrice(inToken);
        (outTokenPrice.price,outTokenPrice.decimal) = getPrice(outToken);
        IPool.EstimateSlippageInput memory params;
        params.inPoolValue = IPool(inPool).getPoolValue(inTokenPrice.price, inTokenPrice.decimal);
        params.inPrice = inTokenPrice.price;
        params.inAmount = inAmount;
        params.inDecimal = inTokenPrice.decimal;
        params.price = outTokenPrice.price;
        params.decimal = outTokenPrice.decimal;
        Price memory slippage;
        (slippage.price,slippage.decimal) = IPool(outPool).estimateSlippage(params);
        Price memory beginPrice = getBeginPrice(inTokenPrice,outTokenPrice);
        Price memory actualPrice = getActualPrice(beginPrice,slippage);

        uint256 inValue = inTokenPrice.price*inAmount;
        inValue = MathUtils.convertDecimal(inValue,actualPrice.decimal,inTokenPrice.decimal);
        //TODO outAmount的小数点跟outTarget Token之间的小数点差异需考虑
        uint256 outAmount = inValue/actualPrice.price;

        //not consider yet
        /*uint8 inTokenDecimal = ERC20(inToken).decimals();
        uint8 outTokenDecimal = ERC20(outToken).decimals();
        if(inTokenDecimal != outTokenDecimal){
            outAmount = MathUtils.convertDecimal(outAmount,outTokenPrice.decimal,inTokenPrice.decimal);
        }*/

        uint256 feeAmount = outAmount*fee.fee;
        outAmount = outAmount - MathUtils.convertDecimal(feeAmount,actualPrice.decimal,actualPrice.decimal + fee.decimal);

        IPool(inPool).addLiquidity{value:msg.value}(msg.sender,inAmount);
        IPool(outPool).removeLiquidity(msg.sender, outAmount);

        inValue = MathUtils.convertDecimal(inValue, 0, actualPrice.decimal);
        IEasyToken(EASYAddress).onSwap(msg.sender,inValue);
        emit Swap(msg.sender, inToken, inAmount, outToken, outAmount);
    }


    function getBeginPrice(
        Price memory inPrice,
        Price memory outPrice
    ) internal pure returns(Price memory begin){
        if(inPrice.decimal > outPrice.decimal){
            outPrice.price = MathUtils.convertDecimal(outPrice.price, inPrice.decimal, outPrice.decimal);
            begin.decimal = inPrice.decimal;
        }else{
            inPrice.price = MathUtils.convertDecimal(inPrice.price, outPrice.decimal, inPrice.decimal);
            begin.decimal = outPrice.decimal;
        }
        begin.price = inPrice.price/outPrice.price;
        return begin;
    }

    function getActualPrice(
        Price memory beginPrice,
        Price memory slippage
    ) internal pure returns (Price memory actualPrice){
        uint deltaPrice = beginPrice.price * slippage.price;
        beginPrice.price = MathUtils.convertDecimal(beginPrice.price, beginPrice.decimal + slippage.decimal,beginPrice.decimal);
        actualPrice.price = (beginPrice.price + deltaPrice) >> 1;
        actualPrice.decimal = beginPrice.decimal + slippage.decimal;
    }
}
