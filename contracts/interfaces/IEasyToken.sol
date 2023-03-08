// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IEasyToken {
    /// @notice sent when settings updated
    event SettingsUpdated(uint256 oldSetting, uint256 newSetting);

    /// @notice set the poolManager address to Easy Token. will be called at PoolManager constructor
    /// @param poolMgr, the address of poolManager
    function setPoolManager(address poolMgr) external;

    /// @notice update the ratio settings for adding liquidity and swap
    /// @param newSetting the new setting
    function updateSettings(uint256 newSetting) external;

    /// @notice called when LP add liquidity, will mint EASY to LP
    /// @param lp address of LP
    /// @param addValue, the liquidity added, decimal = 0
    function onAddLiquidity(address lp, uint256 addValue) external;

    /// @notice called when trader did swap
    /// @param trader ,address of trader
    /// @param inValue , the value swapped, decimal = 0
    function onSwap(address trader, uint256 inValue) external;
}
