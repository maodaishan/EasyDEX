// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IEasyToken.sol";
import "./interfaces/IPoolManager.sol";
import "./Governance.sol";
import "./utils/MathUtils.sol";


contract Easy is Ownable,Governance,ERC20,IEasyToken {
    /// 3 stages.every stage has 4 bytes for edge(uint32) and 1 byte for the target ratio.
    /// from right to left, is higher to lower,begin from 0.
    /// e.g.  0x7735 9400  00    3B9A CA00    32    05F5 E100   64
    ///        2000000000   0   1000000000    50    100000000  100
    /// means the "Easy token reward ratio"(percentage) on different "total pool liquidity" (by USD):
    /// 0          <= liquidity < 100000000 ,   target reward ratio = 100%
    /// 100000000  <= liquidity < 200000000,    target slippage = 50%
    /// 200000000  <= liquidity                 target slippage  = 0%
    uint128 constant GATE_SETTINGS_MASK = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
    uint64 constant SINGLE_SETTING_MASK = 0xFFFFFFFFFF;
    uint8 constant SHIFT = 40;
    uint8 constant SETTING_NUMBER = 3;
    uint8 constant TRADE_SHIFT = SHIFT*SETTING_NUMBER;

    uint256 settings;
    address poolManager;

    constructor(uint256 defaultSettings)
    ERC20("Easy", "EASY")
    Governance(address(this)
    ) {
        settings = defaultSettings;
        _mint(msg.sender, 10000000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function setPoolManager(address poolMgr) external onlyOwner{
        require(poolMgr != address(0),'invalid poolMgr');
        poolManager = poolMgr;
    }

    function updateSettings(uint256 newSetting) external onlyOwner{
        require(checkSettingValue(newSetting),'invalid setting');
        uint256 oldSettings = settings;
        settings = newSetting;
        emit SettingsUpdated(oldSettings,settings);
    }

    function checkSettingValue(uint256 newSetting) private pure returns (bool){
        //TODO : check settings
        return true;
    }

    function onAddLiquidity(address lp, uint256 addValue) external onlyOwner {
        require(poolManager != address(0),'invalid poolMgr');
        uint256 tvl = IPoolManager(poolManager).getTVL();
        uint8 ratio = getMintRatio(tvl,settings);
        uint256 mintAmount = addValue * ratio;
        mintAmount = MathUtils.convertDecimal(mintAmount, decimals(), 2);
        _mint(lp, mintAmount);
    }

    /// @notice decimal = 2
    function getMintRatio(
        uint256 tvl,
        uint256 inputSetting
    ) private pure returns (uint8 ratio){
        uint256 low;
        uint256 high;
        uint128 liquidity_setting = uint128(inputSetting & SINGLE_SETTING_MASK);
        for(uint8 i = 0; i < SETTING_NUMBER; i++){
            uint64 single_setting = uint64(liquidity_setting & SINGLE_SETTING_MASK);
            ratio = uint8(single_setting & 0xFF);
            high = single_setting >> 8;
            if(tvl >= low && tvl < high){
                return ratio;
            }else{
                liquidity_setting = liquidity_setting >> SHIFT;
            }
        }
        revert('no ratio found');
    }

    function onSwap(address trader, uint256 tradeValue) external onlyOwner {
        require(poolManager != address(0),'invalid poolMgr');
        uint256 tvl = IPoolManager(poolManager).getTVL();
        uint8 ratio = getMintRatio(tvl,settings >> TRADE_SHIFT);
        uint256 mintAmount = tradeValue * ratio;
        mintAmount = MathUtils.convertDecimal(mintAmount, decimals(), 2);
        _mint(trader, mintAmount);
    }
}
