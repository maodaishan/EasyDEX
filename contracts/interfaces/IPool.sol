// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IPool {
    /// @notice emitted when liquidity updated. can be add or remove.
    /// @param poolAddress, address of the pool
    /// @param oldLiquidity, the liquidity before update
    /// @param newLiquidity, the liquidity after update
    event liquidityUpdated(address indexed poolAddress,uint256 indexed oldLiquidity,uint256 indexed newLiquidity);

    /// @notice emitted when settings were updated
    /// @param poolAddress, address of the pool
    /// @param oldSettings, the settings before update
    /// @param newSettings, the settings after update
    event settingsUpdated(address indexed poolAddress, uint256 indexed oldSettings, uint256 indexed newSettings);

    /// @notice update the settings influencing the slippage of the pool
    /// @param newSettings,should follow the format,refer to the constant MASK defined in this file.
    /// @dev this should only be called by Owner; the param will be checked, if invalid, it'll revert.
    ///      "settingsUpdated" event will be emitted if success.
    /// @return whether update success.
    function updateSettings(uint256 newSettings) external returns (bool);

    /// @notice LP calls this function to add liquidity to the pool
    /// @param addedLiquidity, the liquidity will be added to this pool,if the pool is ETH, it should equal to msg.value
    /// @dev if token is ERC20, calling this will cause transferFrom.
    ///      will call PoolManager.onPoolLiquidityAdded callback,which will mint ELP to LP.
    ///      "liquidityUpdated" event will be emitted if success.
    /// @return latest liquidity after this function be called.
    function addLiquidity(uint256 addedLiquidity) external payable returns (uint256);

    /// @notice LP calls this function to remove liquidity
    /// @dev Will call
    ///      this function will add the LP Owner to a map that can withdraw token; it won't directly transfer
    ///      token to the LP Owner, so LP Owner should call "withdraw" function to really get the token.
    ///      "liquidityUpdated" event will be emitted if success.
    /// @return the latest liquidity after this function be called.
    function removeLiquidity() external returns (uint256);

    /// @notice after LP called removeLiquidity,he/she could call withdraw to get the token
    function withdraw() external;
}
