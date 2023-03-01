// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IGovernance {
    /// @notice add allowed address,only allowed address can be used in proposal "targetContract".
    /// @dev  the allowed address should be pool or poolManager.
    function addAllowedAddress(address addr) external;

    /// @notice to initialize a proposal. the proposal should meet 2 conditions to be executed:
    ///         1. be confirmed by Owner (avoid "too easy" and "harmful" proposals be executed)
    ///         2. at least "gate" EASY voted for this proposal
    /// @param contentHash, hash of the proposal's content, should contain the selector,data, and some descriptions.
    /// @param gate at least how many EASY token should prove this proposal, to make it executable.
    /// @param targetContract the contract address whose interface will be called if proposal passed.
    /// @param param ,can be get by : abi.encodeWithSelector(selector,...)
    /// @dev after initProposal succeed, Owner should confirm it, and EASY holders should vote for it.
    ///      after the 2 conditions met, anyone can call executeProposal to execute it
    /// @return proposalIndex , the No. of the new initialized proposal.
    function initProposal(uint256 contentHash, uint256 gate, address targetContract, bytes calldata param) external returns(uint32 proposalIndex);

    /// @notice Only owner can call this,to confirm the proposal, can receive or reject
    /// @param proposalIndex ,the No. of the proposal get from "initProposal"
    function confirmProposal(uint32 proposalIndex) external;

    /// @notice EASY holders call this to vote for a proposal
    /// @param proposalIndex ,the proposal to vote for
    function voteProposal(uint32 proposalIndex) external;

    /// @notice anyone can call this to execute a proposal if it meets the conditions.
    /// @param proposalIndex , the proposal be executed
    function executeProposal(uint32 proposalIndex) external;
}
