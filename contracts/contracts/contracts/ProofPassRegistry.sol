// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ProofPassRegistry
/// @notice On-chain trust registry for ProofPass skill credentials.
/// Only addresses approved by the contract owner (universities / assessment
/// providers) may issue or revoke credentials. Students and employers only
/// ever read the registry; they never write to it directly.
contract ProofPassRegistry {
    struct SkillCredential {
        bytes32 proofHash;   // hash of the off-chain credential/claim payload
        address issuer;      // who issued this credential
        uint256 issuedAt;    // block timestamp of issuance
        bool isRevoked;      // true once the issuer revokes it
    }

    /// @dev contract owner, can approve/remove issuers
    address public owner;

    /// @dev issuer address => approved to issue/revoke credentials
    mapping(address => bool) public approvedIssuers;

    /// @dev student => skill name => credential
    mapping(address => mapping(string => SkillCredential)) public registry;

    event IssuerApproved(address indexed issuer, string name);
    event IssuerRemoved(address indexed issuer);
    event CredentialIssued(address indexed student, string skill, bytes32 proofHash, address indexed issuer);
    event CredentialRevoked(address indexed student, string skill, address indexed revokedBy);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "ProofPass: caller is not the owner");
        _;
    }

    modifier onlyApprovedIssuer() {
        require(approvedIssuers[msg.sender], "ProofPass: caller is not an approved issuer");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ------------------------------------------------------------------
    // Issuer management (Phase 11: blockchain trust registry)
    // ------------------------------------------------------------------

    /// @notice Approve a new issuer (a university or assessment provider).
    function approveIssuer(address _issuer, string calldata _name) external onlyOwner {
        require(_issuer != address(0), "ProofPass: zero address");
        approvedIssuers[_issuer] = true;
        emit IssuerApproved(_issuer, _name);
    }

    /// @notice Remove a previously approved issuer.
    function removeIssuer(address _issuer) external onlyOwner {
        approvedIssuers[_issuer] = false;
        emit IssuerRemoved(_issuer);
    }

    /// @notice Transfer contract ownership (e.g. to a multisig later).
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "ProofPass: zero address");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }

    // ------------------------------------------------------------------
    // Credential issuance and revocation (Phases 2 & 8)
    // ------------------------------------------------------------------

    /// @notice Issue a skill/academic credential to a student.
    /// @dev Only an approved issuer can call this. A student cannot issue
    /// their own credentials, which is the vulnerability this fixes.
    function issueSkillCredential(
        address _student,
        string calldata _skill,
        bytes32 _proofHash
    ) external onlyApprovedIssuer {
        require(_student != address(0), "ProofPass: zero address");
        require(bytes(_skill).length > 0, "ProofPass: empty skill name");
        require(_proofHash != bytes32(0), "ProofPass: empty proof hash");

        registry[_student][_skill] = SkillCredential({
            proofHash: _proofHash,
            issuer: msg.sender,
            issuedAt: block.timestamp,
            isRevoked: false
        });

        emit CredentialIssued(_student, _skill, _proofHash, msg.sender);
    }

    /// @notice Revoke a previously issued credential.
    /// @dev Only the original issuer (or the contract owner, for cleanup)
    /// can revoke. This is what makes the "revoke live -> employer check
    /// fails instantly" demo possible.
    function revokeCredential(address _student, string calldata _skill) external {
        SkillCredential storage cred = registry[_student][_skill];
        require(cred.issuedAt != 0, "ProofPass: credential does not exist");
        require(
            msg.sender == cred.issuer || msg.sender == owner,
            "ProofPass: only the issuer or owner can revoke"
        );
        require(!cred.isRevoked, "ProofPass: already revoked");

        cred.isRevoked = true;
        emit CredentialRevoked(_student, _skill, msg.sender);
    }

    // ------------------------------------------------------------------
    // Verification (Phase 11 / employer-facing read)
    // ------------------------------------------------------------------

    /// @notice Check whether a student holds a valid, non-revoked credential
    /// for a skill, issued by a still-approved issuer.
    /// @return isValid true only if the credential exists, is not revoked,
    /// and its issuer is still approved right now.
    /// @return issuer the address that issued the credential (zero if invalid).
    /// @return proofHash the stored hash, so the caller can compare it
    /// against a freshly recomputed hash of the presented claim.
    function verifySkill(address _student, string calldata _skill)
        external
        view
        returns (bool isValid, address issuer, bytes32 proofHash)
    {
        SkillCredential memory cred = registry[_student][_skill];

        if (cred.issuedAt == 0 || cred.isRevoked || !approvedIssuers[cred.issuer]) {
            return (false, address(0), bytes32(0));
        }

        return (true, cred.issuer, cred.proofHash);
    }

    /// @notice Convenience getter returning the raw stored record.
    function getCredential(address _student, string calldata _skill)
        external
        view
        returns (SkillCredential memory)
    {
        return registry[_student][_skill];
    }
}
