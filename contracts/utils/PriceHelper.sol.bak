// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/FeedRegistryInterface.sol";
import "@chainlink/contracts/src/v0.8/Denominations.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract PriceHelper is Initializable{
    FeedRegistryInterface internal registry;

    /**
     * Be careful,_registry should be different on different networks.
     * ETH mainnet: 0xAa7F6f7f507457a1EE157fE97F6c7DB2BEec5cD0
     */
    function registerOracle(address _registry) internal initializer {
        registry = FeedRegistryInterface(_registry);
    }

    /// @notice get price and decimal, quote is USD.
    /// @param base ,the token whose price is being queryed
    /// @dev calling chainlink oracle, may revert ,e.g. base is not supported.
    /// @return price , from oracle
    /// @return decimal , from oracle
    function getPrice(address base) internal view returns (uint256,uint8) {
        (
        /*uint80 roundID*/,
        int priceGot,
        /*uint startedAt*/,
        /*uint timeStamp*/,
        /*uint80 answeredInRound*/
        ) = registry.latestRoundData(base, Denominations.USD);
        uint8 decimal = registry.decimals(base, Denominations.USD);
        require(priceGot > 0,'invalid price');
        return (uint256(priceGot),decimal);
    }
}
