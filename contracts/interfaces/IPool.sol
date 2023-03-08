// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IPool {
    struct EstimateSlippageInput {
        uint256 inPoolValue; //decimal = 0
        uint inPrice;
        uint256 inAmount;
        uint8 inDecimal;
        uint price;
        uint8 decimal;
    }

    /// @notice emitted when liquidity updated. can be add or remove.
    /// @param poolAddress, address of the pool
    /// @param oldLiquidity, the liquidity before update
    /// @param newLiquidity, the liquidity after update
    event liquidityUpdated(
        address indexed poolAddress,
        uint256 indexed oldLiquidity,
        uint256 indexed newLiquidity);

    /// @notice emitted when settings were updated
    /// @param poolAddress, address of the pool
    /// @param oldSettings, the settings before update
    /// @param newSettings, the settings after update
    event settingsUpdated(
        address indexed poolAddress,
        uint256 indexed oldSettings,
        uint256 indexed newSettings);

    /// @notice update the settings influencing the slippage of the pool
    /// @param newSettings,should follow the format,refer to the constant MASK defined in this file.
    /// @dev this should only be called by Owner; the param will be checked, if invalid, it'll revert.
    ///      "settingsUpdated" event will be emitted if success.
    /// @return whether update success.
    function updateSettings(uint256 newSettings) external returns (bool);

    /// @notice used in addLiquidity, or swap.
    /// @param trader ,address of trader
    /// @param amount, the amount of change.
    /// @dev will do transfer
    function addLiquidity(address trader, uint256 amount) external payable returns (uint256);

    /// @notice used in removeLiquidity, or swap.
    /// @param trader ,address of trader
    /// @param amount, the amount of change.
    /// @dev will do transfer
    function removeLiquidity(address trader, uint256 amount) external returns (uint256);

    /// @notice after LP called removeLiquidity,he/she could call withdraw to get the token
    function withdraw() external;

    /// @notice estimate the slippage of the swap
    /// @param paramInput the parameters needed for estimate the slippage
/*    /// @param inPoolValue , pool value of swap in token in USD
    /// @param inPrice, price of swap in token(to USD)
    /// @param inAmount, the amount of swap in token
    /// @param inDecimal the decimal of inValue
    /// @param price ,price of token of the pool got from oracle (to USD)
    /// @param decimal, decimal of price*/
    /// @return ratio, the slippage ratio
    /// @return decimal, decimal of slippage ratio
    function estimateSlippage(
        EstimateSlippageInput memory paramInput
    ) external view returns(uint,uint8);
/*    function estimateSlippage(
        uint256 inPoolValue, //decimal = 0
        uint inPrice,
        uint256 inAmount,
        uint8 inDecimal,
        uint price,
        uint8 decimal
    ) external view returns(uint,uint8);*/

    /// @notice get current value of pool
    /// @param price from oracle
    /// @param decimal of price
    /// @return value ,current value of pool, decimal is 0
    function getPoolValue(uint price, uint8 decimal) external view returns (uint256 value);
}
