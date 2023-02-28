"SPDX-License-Identifier: <SPDX-License>"
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

library ERC20Helper {
    /// @notice try to get balance of queryAddr from contractAddr, but we don't know whether contractAddr is ERC20 contract.
    /// @param contractAddr, the contract address, it's not guaranteed it's ERC20
    /// @param queryAddr, the address we wish to get balance
    /// @return success, whether this query successed
    /// @return balance, if succeed, the balance of queryAddr.
    function tryGetERC20Balance(
        address contractAddr,
        address queryAddr
    ) internal view returns(bool,uint256){
        if(!Address.isContract(contractAddr)){
            return (false,0);
        }

        (bool success,bytes memory data) =
        contractAddr.staticcall(abi.encodeWithSelector(IERC20.balanceOf.selector,queryAddr));
        if(!success){
            return (false,0);
        }
        uint256 balance = abi.decode(data,(uint256));
        return (true,balance);
    }

    /// @notice Transfers tokens from the targeted address to the given destination
    /// @notice Errors with 'STF' if transfer fails
    /// @param token The contract address of the token to be transferred
    /// @param from The originating address from which the tokens will be transferred
    /// @param to The destination address of the transfer
    /// @param value The amount to be transferred
    function safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 value
    ) internal {
        (bool success, bytes memory data) =
        token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'SafeTransferFrom');
    }

    /// @notice Transfers tokens from msg.sender to a recipient
    /// @dev Errors with ST if transfer fails
    /// @param token The contract address of the token which will be transferred
    /// @param to The recipient of the transfer
    /// @param value The value of the transfer
    function safeTransfer(
        address token,
        address to,
        uint256 value
    ) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'SafeTransfer');
    }

    /// @notice Transfers ETH to the recipient address
    /// @dev Fails with `STE`
    /// @param to The destination of the transfer
    /// @param value The value to be transferred
    function safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        require(success, 'STE');
    }
}
