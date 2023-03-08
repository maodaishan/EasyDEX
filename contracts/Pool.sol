// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IPool.sol";
import "./utils/ERC20Helper.sol";
import "./utils/Common.sol";
import "./utils/MathUtils.sol";

contract Pool is Ownable,IPool {
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
    uint256 public constant LQ_TARGET_PRICE_RANGE = 0xFF<<32;

    /// @notice Target of slippages.
    /// 3 stages.every stage has 4 bytes for edge(uint32) and 1 byte for the
    /// target slippage from right to left, is higher to lower,begin from 0.
    /// e.g.  0xFFFFFFFF  A  0x4C4B40  5  07A120  0
    ///       very large  10 5000000   5  500000  0
    /// means the pool liquidity (by USD):
    /// 0       <= liquidity < 500000 ,   target slippage = 0
    /// 500000  <= liquidity < 5000000,   target slippage = 5%
    /// 5000000 <= liquidity              target slippage  = 10%
    uint256 public constant SETTINGS_TARGET_SLIPPAGES = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF<<40;
    uint256 private constant TARGET_SLIPPAGES_SINGLE_MASK = 0xFFFFFFFFFF;
    uint256 private constant SINGLE_TARGET_SETTINGS_LENGTH = 40;

    /// @notice influence of pools ratio.EstimateSlippageInput
    /// 3 stages, every stage has 2 bytes for edge(fixed8x8) and 2 bytes for
    /// target ratio to slippage (fixed8x8)
    uint256 public constant SETTINGS_POOL_RATIO_SLIPPAGES = 0xFFFFFFFFFFFFFFFFFFFFFFFF<<160;

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
    ){
        settings = inputSettings;
        tokenAddress = token;
        managerAddress = msg.sender;
        //liquidity=0;  initial value is 0
    }

    /// @inheritdoc IPool
    function updateSettings(
        uint256 newSettings
    )public
    onlyOwner
    returns (bool){
        require(checkSettings(newSettings) == true);
        uint256 oldSettings = settings;
        settings = newSettings;
        emit settingsUpdated(address(this),oldSettings,newSettings);
        return true;
    }

    function checkSettings(
        uint256 newSettings
    ) internal pure returns (bool){
        //TODO：check the input settings
        return true;
    }
/*

    /// @inheritdoc IPool
    function addLiquidity(uint256 addedLiquidity) public payable returns (uint256){
        bool isETH = Common.isETH(tokenAddress);
        uint256 oldLiquidity = liquidity;
        if(isETH){
            liquidity += msg.value;
            //balance can bigger than liquidity, because LP may removeLiquidity but not withdraw.
            require(address(this).balance >= liquidity,'balance not match');
        }else{
            ERC20Helper.safeTransferFrom(tokenAddress,msg.sender,address(this),addedLiquidity);
            (bool success, uint256 newLiquidity) = ERC20Helper.tryGetERC20Balance(tokenAddress,address(this));
            require(success,'getBalance failed');
            liquidity += addedLiquidity;
            require(newLiquidity >= liquidity,'liquidity not match');
        }

        OnPoolLiquidityUpdated(managerAddress).onPoolLiquidityAdded(msg.sender, addedLiquidity);  //may revert on errors.
        emit liquidityUpdated(address(this),oldLiquidity,liquidity);
        return liquidity;
    }

    /// @inheritdoc IPool
    function removeLiquidity(
    ) public returns (uint256){
        uint256 removedLiquidity = OnPoolLiquidityUpdated(managerAddress).onPoolLiquidityRemoved(msg.sender);
        require(removedLiquidity > 0, 'nothing refund');
        require(removedLiquidity <= liquidity, 'not enough liquidity');
        uint256 oldLiquidity = liquidity;
        liquidity -= removedLiquidity;
        require(liquidity >=0 , 'liquidity smaller than 0');
        pendingWithdraw[msg.sender] = pendingWithdraw[msg.sender] + removedLiquidity;
        emit liquidityUpdated(address(this),oldLiquidity,liquidity);
        return liquidity;
    }
*/

    function addLiquidity(
        address user,
        uint256
        amount
    )external payable onlyOwner returns(uint256){
        bool isETH = Common.isETH(tokenAddress);
        uint256 oldLiquidity = liquidity;
        if(isETH){
            require(amount == msg.value,'value not match');
            liquidity += msg.value;
            //balance can bigger than liquidity, because LP may removeLiquidity but not withdraw.
            require(address(this).balance >= liquidity,'balance not match');
        }else{
            uint256 allowance = IERC20(tokenAddress).allowance(user,address(this));
            require(allowance >= amount,'not enough allowance for transfer');
            ERC20Helper.safeTransferFrom(tokenAddress,user,address(this),amount);
            (bool success, uint256 newLiquidity) = ERC20Helper.tryGetERC20Balance(tokenAddress,address(this));
            require(success,'getBalance failed');
            liquidity += amount;
            require(newLiquidity >= liquidity,'liquidity not match');
        }
        emit liquidityUpdated(address(this),oldLiquidity,liquidity);
        return liquidity;
    }


    function removeLiquidity(
        address user,
        uint256 amount
    )external onlyOwner returns (uint256){
        //bool isETH = Common.isETH(tokenAddress);
        uint256 oldLiquidity = liquidity;
        liquidity -= amount;
        ERC20Helper.safeTransferETH(user, amount);
        pendingWithdraw[user] += amount;
        /*if(isETH){
            require(liquidity - amount >= 0, 'not enough liquidity');
            liquidity -= amount;
            ERC20Helper.safeTransferETH(user, amount);
            //balance can bigger than liquidity, because LP may removeLiquidity but not withdraw.
            require(address(this).balance >= liquidity,'balance not match');
        }else{
            require(liquidity - amount > 0, 'not enough liquidity');
            ERC20Helper.safeTransfer(tokenAddress,user,amount);
            (bool success, uint256 newLiquidity) = ERC20Helper.tryGetERC20Balance(tokenAddress,address(this));
            require(success,'getBalance failed');
            liquidity -= amount;
            require(newLiquidity >= liquidity,'liquidity not match');
        }*/
        emit liquidityUpdated(address(this),oldLiquidity,liquidity);
        return liquidity;
    }

    /// @inheritdoc IPool
    function withdraw() public{
        uint256 amount = pendingWithdraw[msg.sender];
        require(amount > 0, 'nothing withdraw');
        pendingWithdraw[msg.sender] = 0;
        bool isETH = Common.isETH(tokenAddress);
        if(isETH){
            ERC20Helper.safeTransferETH(msg.sender,amount);
        }else{
            ERC20Helper.safeTransfer(tokenAddress,msg.sender,amount);
        }
    }

    /// @inheritdoc IPool
    function estimateSlippage(
        EstimateSlippageInput memory params
    ) external view returns(uint,uint8){
        uint256 poolValue = params.price * liquidity;
        poolValue = MathUtils.convertDecimal(poolValue,0,params.decimal);

        //judge the slippage mode
        //if poolValue > gate, poolMode, else settingMode
        bool settingMode = true;
        uint256 gate = settings & LQ_GATE_MASK;
        if(poolValue >= gate){
            settingMode = false;
        }
        if(!settingMode){
            return estimateSlippageByPoolMode(params.inPrice,params.inAmount,params.inDecimal,params.price,params.decimal);
        }

        //get T
        uint128 slippageTargets = uint128((settings & SETTINGS_TARGET_SLIPPAGES) >> 40);
        uint32 low = 0;
        uint32 high = 0;
        uint8 T = 0; //target Ratio, check it from the protocol, decimal of T is 2
        for(uint8 i = 0; i < 3; i++){
            uint32 singleTargetSetting = uint32(slippageTargets & TARGET_SLIPPAGES_SINGLE_MASK);
            (high,T) = getSingleTargetSetting(singleTargetSetting);
            // if we never meet it, the highest T is used.
            if(poolValue >= low && poolValue < high){
                break;
            }else{
                low = high;
                slippageTargets = slippageTargets >> SINGLE_TARGET_SETTINGS_LENGTH;
            }
        }

        //calculate R
        uint256 inValue = params.inPrice * params.inAmount;
        //extend inValue by SLIPPAGE_DEFAULT_DECIMAL times, to make R decimal = SLIPPAGE_DEFAULT_DECIMAL
        inValue = MathUtils.convertDecimal(inValue, (SLIPPAGE_DEFAULT_DECIMAL),params.inDecimal);
        uint256 R = inValue/poolValue;
        if(R == 0){
            return (0,0);
        }

        //calculate X,decimal = SLIPPAGE_DEFAULT_DECIMAL
        //inPoolValue = MathUtils.convertDecimal(inPoolValue, (0-SLIPPAGE_DEFAULT_DECIMAL), 0);
        uint256 X = params.inPoolValue/poolValue;

        uint256 T2 = MathUtils.convertDecimal(uint256(T), SLIPPAGE_DEFAULT_DECIMAL, 2);
        return (T2*R*X,SLIPPAGE_DEFAULT_DECIMAL*3);
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
        revert('poolMode not supported now');
    }

    function getPoolValue(
        uint price,
        uint8 decimal
    ) external view returns (uint256 value){
        value = price * liquidity;
        value = MathUtils.convertDecimal(value, 0 ,decimal);
    }
}
