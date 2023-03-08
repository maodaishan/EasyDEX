// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IPoolManager {
    /// @notice emitted when addLiquidity is called
    /// @param pool the pool to which liquidity is added
    /// @param lp the Liquidity Provider
    /// @param tokenAmount the token lp supplied
    /// @param elfMinted new minted alf amount
    event LiquidityAdded(address indexed pool,address lp, uint256 tokenAmount, uint256 elfMinted);

    /// @notice emitted when removeLiquidity is called
    /// @param pool the pool to which liquidity is removed
    /// @param lp the Liquidity Provider
    /// @param tokenToLP the token lp can get
    /// @param elfBurned the amount that ELF burned
    event LiquidityRemoved(address indexed pool,address lp, uint256 tokenToLP, uint256 elfBurned);

    /// @notice emitted when updateFee is called
    /// @param oldFee, fee before updated
    /// @param oldDecimal, decimal of oldFee
    /// @param newFee, fee after updated
    /// @param newDecimal, decimal of newFee
    event FeeUpdated(uint24 oldFee, uint8 oldDecimal, uint24 newFee, uint8 newDecimal);

    /// @notice swap happened
    /// @param trader trader
    /// @param inToken, swapped in token
    /// @param inAmount, the amount of inToken
    /// @param outToken, swapped out token
    /// @param outAmount, the amount of outToken
    event Swap(address trader, address indexed inToken, uint256 inAmount, address indexed outToken, uint256 outAmount);

    /// @notice update the fee ratio, fee will be collected from out token
    function updateFee(uint24 newFee,uint8 newDecimal)  external;

    /// @notice add a new pool, this should be called by EASY holder vote.
    /// @param tokenAddr address of new added token,should be ERC20 compatible
    /// @param settings default settings of the pool, can be updated after vote.
    /// @return newPool address of the new added pool
    function addPool(address tokenAddr,uint256 settings) external returns (address newPool);

    /// @notice update settings of a pool, should be called by EASY holder vote.
    /// @param pool the pool which will be updated
    /// @param newSettings the new settings will be set
    /// @return success whether update succeeded
    function updatePoolSettings(address pool, uint256 newSettings) external returns (bool success);

    /// @notice get ELF price
    /// @dev will get price from oracle, and amount from pool,sum them, then divide with ELF supply
    /// @return price the ELF price
    function getELFPrice() external view returns (uint price, uint8 decimal);

    /// @notice LP calls this function to add liquidity to the pool
    /// @param tokenAddr, the token LP wish to use to supply liquidity
    /// @param addedLiquidity, the liquidity will be added to this pool,if the pool is ETH, it should equal to msg.value
    /// @dev if token is ERC20, calling this will cause transferFrom. LP should approve poolMgr to use his/her token.
    ///      "liquidityUpdated" event will be emitted if success.
    ///      will mint ELF to LP
    function addLiquidity(address tokenAddr, uint256 addedLiquidity) external payable;

    /// @notice LP calls this function to remove liquidity
    /// @param receiveToken ,the token LP wish to receive after removed liquidity
    /// @dev Will call
    ///      this function will add the LP Owner to a map that can withdraw token; it won't directly transfer
    ///      token to the LP Owner, so LP Owner should call "withdraw" function to really get the token.
    ///      "liquidityUpdated" event will be emitted if success.
    function removeLiquidity(address receiveToken) external;

    /// @notice trader call this to swap token
    /// @param inToken swap in
    /// @param outToken swap out
    /// @param inAmount amount of inToken
    function swap(address inToken, uint256 inAmount, address outToken) external payable;
}
