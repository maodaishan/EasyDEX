// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

library Common {
    address internal constant ETH_ADDRESS=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function isETH(
        address addr
    ) external pure returns(bool){
        return addr == ETH_ADDRESS;
    }
}
