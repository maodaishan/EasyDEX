// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IPool.sol";
import "./interfaces/OnPoolLiquidityUpdated.sol";
import "./utils/ERC20Helper.sol";
import "./utils/Common.sol";

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

    /// @notice influence of pools ratio.
    /// 3 stages, every stage has 2 bytes for edge(fixed8x8) and 2 bytes for
    /// target ratio to slippage (fixed8x8)
    uint256 public constant SETTINGS_POOL_RATIO_SLIPPAGES = 0xFFFFFFFFFFFFFFFFFFFFFFFF<<160;


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

    /// @inheritdoc IPool
    function addLiquidity(uint256 addedLiquidity) public payable returns (uint256){
        bool isETH = Common.isETH(tokenAddress);
        uint256 oldLiquidity = liquidity;
        if(isETH){
            liquidity += msg.value;
            require(address(this).balance == liquidity,'balance not match');
        }else{
            ERC20Helper.safeTransferFrom(tokenAddress,msg.sender,address(this),addedLiquidity);
            (bool success, uint256 newLiquidity) = ERC20Helper.tryGetERC20Balance(tokenAddress,address(this));
            require(success,'getBalance failed');
            liquidity += addedLiquidity;
            require(newLiquidity == liquidity,'liquidity not match');
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
}
