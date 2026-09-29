const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProofPassRegistry", function () {
  let registry;
  let owner, university, student, attacker, employer;

  const skill = "Python";
  const proofHash = ethers.keccak256(ethers.toUtf8Bytes("Python:advanced"));

  beforeEach(async function () {
    [owner, university, student, attacker, employer] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("ProofPassRegistry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();
  });

  it("sets the deployer as owner", async function () {
    expect(await registry.owner()).to.equal(owner.address);
  });

  describe("issuer management", function () {
    it("lets the owner approve an issuer", async function () {
      await expect(registry.approveIssuer(university.address, "Test University"))
        .to.emit(registry, "IssuerApproved")
        .withArgs(university.address, "Test University");

      expect(await registry.approvedIssuers(university.address)).to.equal(true);
    });

    it("rejects issuer approval from a non-owner", async function () {
      await expect(
        registry.connect(attacker).approveIssuer(attacker.address, "Fake University")
      ).to.be.revertedWith("ProofPass: caller is not the owner");
    });

    it("lets the owner remove an issuer", async function () {
      await registry.approveIssuer(university.address, "Test University");
      await registry.removeIssuer(university.address);
      expect(await registry.approvedIssuers(university.address)).to.equal(false);
    });
  });

  describe("issuing credentials (the access-control fix)", function () {
    it("blocks a student from issuing themselves a credential", async function () {
      await expect(
        registry.connect(student).issueSkillCredential(student.address, skill, proofHash)
      ).to.be.revertedWith("ProofPass: caller is not an approved issuer");
    });

    it("blocks a random attacker from issuing a credential to anyone", async function () {
      await expect(
        registry.connect(attacker).issueSkillCredential(student.address, skill, proofHash)
      ).to.be.revertedWith("ProofPass: caller is not an approved issuer");
    });

    it("lets an approved issuer issue a credential", async function () {
      await registry.approveIssuer(university.address, "Test University");

      await expect(
        registry.connect(university).issueSkillCredential(student.address, skill, proofHash)
      )
        .to.emit(registry, "CredentialIssued")
        .withArgs(student.address, skill, proofHash, university.address);

      const [isValid, issuer] = await registry.verifySkill(student.address, skill);
      expect(isValid).to.equal(true);
      expect(issuer).to.equal(university.address);
    });
  });

  describe("revocation", function () {
    beforeEach(async function () {
      await registry.approveIssuer(university.address, "Test University");
      await registry.connect(university).issueSkillCredential(student.address, skill, proofHash);
    });

    it("lets the issuer revoke their own credential", async function () {
      await expect(registry.connect(university).revokeCredential(student.address, skill))
        .to.emit(registry, "CredentialRevoked")
        .withArgs(student.address, skill, university.address);

      const [isValid] = await registry.verifySkill(student.address, skill);
      expect(isValid).to.equal(false);
    });

    it("lets the contract owner revoke as a fallback", async function () {
      await registry.connect(owner).revokeCredential(student.address, skill);
      const [isValid] = await registry.verifySkill(student.address, skill);
      expect(isValid).to.equal(false);
    });

    it("blocks an unrelated address from revoking", async function () {
      await expect(
        registry.connect(attacker).revokeCredential(student.address, skill)
      ).to.be.revertedWith("ProofPass: only the issuer or owner can revoke");
    });

    it("blocks double revocation", async function () {
      await registry.connect(university).revokeCredential(student.address, skill);
      await expect(
        registry.connect(university).revokeCredential(student.address, skill)
      ).to.be.revertedWith("ProofPass: already revoked");
    });
  });

  describe("verification (employer-facing read)", function () {
    it("returns false for a credential that was never issued", async function () {
      const [isValid, issuer] = await registry.verifySkill(student.address, "Nonexistent");
      expect(isValid).to.equal(false);
      expect(issuer).to.equal(ethers.ZeroAddress);
    });

    it("returns false if the issuer is later de-approved, even without revocation", async function () {
      await registry.approveIssuer(university.address, "Test University");
      await registry.connect(university).issueSkillCredential(student.address, skill, proofHash);

      // credential is valid while issuer is approved
      let [isValid] = await registry.verifySkill(student.address, skill);
      expect(isValid).to.equal(true);

      // owner discovers the issuer was fraudulent and removes them
      await registry.removeIssuer(university.address);

      [isValid] = await registry.verifySkill(student.address, skill);
      expect(isValid).to.equal(false);
    });

    it("returns the stored proof hash so a caller can cross-check a presented claim", async function () {
      await registry.approveIssuer(university.address, "Test University");
      await registry.connect(university).issueSkillCredential(student.address, skill, proofHash);

      const [, , storedHash] = await registry.verifySkill(student.address, skill);
      expect(storedHash).to.equal(proofHash);
    });
  });
});
