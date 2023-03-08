// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

library MathUtils {
    /// @notice convert the value from originDecimal to targetDecimal
    /// @param value the value to be converted, which is originDecimal
    /// @param targetDecimal ,the targeted decimal
    /// @param originDecimal , the decimal of input value
    /// @return newValue , the converted result
    function convertDecimal(
        uint256 value,
        uint8 targetDecimal,
        uint8 originDecimal
    ) internal pure returns(uint256){
        if(targetDecimal == originDecimal){
            return value;
        }else{
            //TODO consider exponentiation is negative
            return value*10**(targetDecimal - originDecimal);
        }
    }


}
