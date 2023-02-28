"SPDX-License-Identifier: <SPDX-License>"
pragma solidity ^0.8.9;

interface OnPoolLiquidityUpdated {
    /// @notice this will be called from Pool.addLiquidity. PoolManager should implement it.
    ///         should mint ELP and transfer to lp.
    /// @param lp, Liquidity Provider who added liquidity to pool. he/she should receive new minted ELP
    /// @param amount, the number of token which LP supplied.
    /// @dev   should revert on any error.
    function onPoolLiquidityAdded(address lp,uint256 amount) external;

    /// @notice this will be called from Pool.removeLiquidity. PoolManager should implement it.
    /// @param lp, the LP who wish to remove liquidity
    /// @dev should burn the LP's ELP, return how much token should be refund to LP
    /// @return refund , how much token should refund to LP
    function onPoolLiquidityRemoved(address lp) external returns (uint32 refund);
}
