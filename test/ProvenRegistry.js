require('babel-register');

const Proven = artifacts.require('../contracts/Proven.sol');
const ProvenDB = artifacts.require('../contracts/ProvenDB.sol');
const ProvenRegistry = artifacts.require('../contracts/ProvenRegistry.sol');
const Verifier = artifacts.require('../contracts/Verifier.sol');
const VerifierDB = artifacts.require('../contracts/VerifierDB.sol');
const VerifierRegistry = artifacts.require('../contracts/VerifierRegistry.sol');
const BondHolder = artifacts.require('../contracts/BondHolder.sol');
const BondHolderRegistry = artifacts.require('../contracts/BondHolderRegistry.sol');
const expectThrow = require('./helpers/expectThrow.js');


contract('Proven', function(accounts) {
  let provenRegistry;
  let provenDB;
  let proven;
  let verifierRegistry;
  let verifierDB;
  let verifier;
  let bondHolder;
  let bondHolderRegistry;
  let deposition1;
  let deposition2;
  let deposition3;
  let deposition4;
  let deposition5;
  let verification1, verification2, verification3;
  let depositor1 = accounts[1];
  let depositor2 = accounts[2];
  let depositor3 = accounts[3];
  let verifier1 = accounts[4];
  let verifier2 = accounts[5];
  let oracle = accounts[6];
  let beneficiary = accounts[7];
  let challenger1 = accounts[8];
  let challenger2 = accounts[9];
  let ipfsPic1 = 'Qmb7Uwc39Q7YpPsfkWj54S2rMgdV6D845Sgr75GyxZfV4V';
  let ipfsPic2 = 'QmQE3gxEE1EaYK3Bi6rgXLTVHGKRZkai94eEABy7A9repJ';
  let ipfsPic3 = 'QmNjDm89By6jQRNwJ2idbCMWKzew2HAXHhbYKxK6Bn5VoW';
  let ipfsPic4 = 'QmVpYa8krJAdwDEcHcWVwyg2vznS3MoAXycaLHmqPWkn8j';
  let ipfsPic5 = 'QmTbhNNgnSzDnQj8mLELcxqZKwUwbzpnHj2iMeqscjpDEF';
  let ipfsPic6 = 'QmXd2t4WbhpDf643ija6byLE4q3L8GBQ3u773wWh5zVRT4';
  let fee = new web3.BigNumber(web3.toWei(.1, 'ether'));

  before(async function(){
    provenRegistry = await ProvenRegistry.new();
    proven = await Proven.new(provenRegistry.address);
    await provenRegistry.setProven(proven.address);
    provenDB = await ProvenDB.new(provenRegistry.address);
    await provenRegistry.setDB(provenDB.address);
    verifierRegistry = await VerifierRegistry.new();
    verifierDB = await VerifierDB.new(verifierRegistry.address);
    await verifierRegistry.setDB(verifierDB.address);
    const timeoutBlocks = 3; 
    const requiredBond = 10; 
    verifier = await Verifier.new(verifierRegistry.address, fee, timeoutBlocks, requiredBond);
    await verifierRegistry.setVerifier(verifier.address);
    await verifierRegistry.setOracle(oracle);
    await verifierRegistry.setProven(proven.address);
    bondHolderRegistry = await BondHolderRegistry.new();
    bondHolder = await BondHolder.new(bondHolderRegistry.address, verifier.address);
    await bondHolderRegistry.setBondHolder(bondHolder.address);
    await verifierRegistry.setBondHolder(bondHolder.address);
	});

  it('should have addresses', async function(){
    assert.isFalse(provenRegistry.address === proven.address);
    assert.isFalse(provenDB.address === proven.address);
    assert.isFalse(verifierRegistry.address === verifier.address);
    assert.isFalse(verifier.DB === verifier.address);
    assert.isFalse(bondHolderRegistry.address === bondHolder.address);
  });

  // Publish a deposition without specifying the depositor
  it('should publish an anonymous deposition', async function(){
    deposition1 = await proven.publishDeposition(ipfsPic1);
    assert(depositor1 != deposition1.logs[0].args['_deponent']);
    assert('DepositionPublished' === deposition1.logs[0].event);
  });

  // Publish a deposition specifying the depositor
  it('should publish a deposition from an account', async function(){
    deposition2 = await proven.publishDeposition(depositor2.address, ipfsPic2);
    assert(depositor2 != deposition2.logs[0].args['_deponent']);
    assert('DepositionPublished' === deposition2.logs[0].event);
  });

  // Publish a deposition directly from the depositor
  it('should publish a deposition made directly by a specific depositor', async function(){
    deposition3 = await proven.publishDeposition(depositor3.address, ipfsPic3, {from: depositor3});
    assert(depositor3 === deposition3.logs[0].args['_deponent']);
    assert('DepositionPublished' === deposition3.logs[0].event);
  });

  // the verifier should be able to set a bond
  it('should let a verifier set up a bond', async function(){
    // there should be no bond to start
    assert(!(await bondHolder.isBonded(verifier1)));
    var amount = new web3.BigNumber(web3.toWei(5, 'ether'));
    var result = await bondHolder.depositBond({ from: verifier1, to: bondHolder.address, value: amount });
    assert(verifier1.address === result.logs[0].args['address']);
    assert('BondDeposited' === result.logs[0].event);
    // there should now be a bond
    assert(await bondHolder.isBonded(verifier1));
    // The bond should be what we set it to
    //    { [String: '11000000000000000000'] s: 1, e: 19, c: [ 110000 ] }
    result = await bondHolder.availableBond(verifier1);
    assert(amount[0] === result[0]);
    assert(amount.s === result.s);
    assert(amount.e === result.e);
    assert(amount.c[0] === result.c[0]);
  });

  // a verifier should be able to publish a deposition through the verifier
  it('should let a verifier publish a deposition through the verifier', async function(){

    deposition4 = await verifier.publishDeposition(ipfsPic4, {from: verifier1, value: fee});
    assert(deposition4.logs[0].event === 'DepositionPublished');
  });

  // the verifier should be able to verify the deposition
  it('should verify an existing deposition', async function(){
    assert(await bondHolder.isBonded(verifier1));
    var depoID = deposition4.logs[0].args.deposition;
    verification1 = await verifier.verifyDeposition(depoID, '', {from: verifier1});
    assert(verification1.logs[0].event === 'DepositionVerified');
    assert(verification1.logs[0].args.deposition === depoID);
  });

  // an unbonded verifier should be able to publish a deposition
  it('should let an unbonded verifier publish a verification', async function(){
    assert(!(await bondHolder.isBonded(verifier2)));
    deposition5 = await verifier.publishDeposition(ipfsPic5, {from: verifier2, value: fee});
    assert(deposition5.logs[0].event === 'DepositionPublished');
  });

  // but the unbonded verifier should not be able to verify it
  it('should not let the unbonded verifier verify the deposition', async function(){
    assert(!(await bondHolder.isBonded(verifier2)));
    var failure = false;
    var depoID = deposition5.logs[0].args.deposition;
    await expectThrow(verifier.verifyDeposition(depoID, '', {from: verifier2}));
  });

  // a bonded verifier should be able to verify the deposition
  // made by an unbonded verifier
  it('should allow verification by a different verifier', async function(){
    assert(await bondHolder.isBonded(verifier1));
    var depoID = deposition5.logs[0].args.deposition;
    verification3 = await verifier.verifyDeposition(depoID, '', {from: verifier1});
    assert(verification3.logs[0].event === 'DepositionVerified');
    assert(verification3.logs[0].args.deposition === depoID);
  });

  // the depositor should be able to look up the verification:
  // based on the IPFS hash
  it('should retrieve the deposition ID from the IPFS hash', async function(){
    var depoID = await verifier.getDepositionFromIPFSHash(ipfsPic5);
    assert(deposition5.logs[0].args.deposition === depoID);
  });

  // Should be able to get the IFPS hash from the deposition ID
  it('should return the IPFS hash from the deposition ID', async function(){
    var ipfsHash = await provenDB.getIPFSHash(deposition5.logs[0].args.deposition);
    assert(web3.toAscii(ipfsHash) === ipfsPic5);
  });

  // Should be able to get the deponent from the deposition ID
  // This is important because it is exercising a lot of integrations.
  it('should return the deponent from the deposition ID', async function(){
    var deponent = await provenDB.getDeponent(deposition5.logs[0].args.deposition);
    assert(deponent === verifier2);
  });

  // test onlyProven() modifier
  it('should respect contract caller restriction', async function(){
    await expectThrow(provenDB.storeDeposition(depositor1, ''));
  });

  // See ../contracts/VerifierDB.sol
  var StateEnum = {
    Unset:       0,
    Initialized: 1,
    Verified:    2,
    Challenged:  3,
    Contested:   4,
    Proven:      5,
    Disproven:   6
  };

  // Helper function for results from ProvenDB.getDetails()
  function parseDetails(details) {
    var result = {
      state: details[0].c[0],
      bounty: details[1].c[0],
      deposedInBlock: details[2].c[0],
      verifier: details[3],
      verifiedInBlock: details[4].c[0],
      challenger: details[5],
      challengedInBlock: details[6].c[0],
      bondAmount: details[7].c[0],
      contestor: details[8]
    };
    return result;
  };

  // claim verification reward and become proven
  it('should claim the verification reward and become proven', async function(){
    var depoID = deposition4.logs[0].args.deposition;
    var detailsBefore = parseDetails(await verifierDB.getDetails(depoID));
    assert(detailsBefore.state === StateEnum.Verified);
    var balanceBefore = web3.eth.getBalance(verifier1);
    var results = await verifier.claimVerificationReward(depoID, {from: verifier1});
    assert(results.logs[0].event === 'DepositionProven');
    var detailsAfter = parseDetails(await verifierDB.getDetails(depoID));
    assert(detailsAfter.state === StateEnum.Proven);
    var balanceAfter = web3.eth.getBalance(verifier1);
    assert(balanceBefore < balanceAfter);
  });

  // Scenario: mining. based on an IPFS hash, we want to verify the image.
  // It turns out that it has been published (but not verified). We want it verified.
  it('should show a verified deposition as verified', async function(){
    var depoID = await verifier.getDepositionFromIPFSHash(ipfsPic1);
    // it exists in the Proven log, but not in the VerifierDB nor on-chain.
    assert('0x0000000000000000000000000000000000000000000000000000000000000000' === depoID);

    // we only know the deposition ID and the IPFS hash because we're mining, which
    // means whe're watching the Proven log events and responding to them.
    var depositionID1 = deposition1.logs[0].args._deposition;
    var init = await verifier.initializeDeposition(depositionID1, ipfsPic1, deposition1.receipt.blockNumber, {from: verifier2, value: fee});
    assert(init.logs[0].event === 'DepositionPublished');

    // Now we should be able to get that deposition ID from the IPFS hash
    depoID = await verifier.getDepositionFromIPFSHash(ipfsPic1);
    assert(depoID == depositionID1);

    // Check the state
    var details = parseDetails(await verifierDB.getDetails(depositionID1));
    assert(details.state === StateEnum.Initialized);

    // Now let's verify it
    var verify = await verifier.verifyDeposition(depositionID1, '', {from: verifier1});
    assert(verify.logs[0].event === 'DepositionVerified');
    assert(verify.logs[0].args.deposition === depositionID1);
    details = parseDetails(await verifierDB.getDetails(depositionID1));
    assert(details.state === StateEnum.Verified);

    // and finally: check that image is verified by IPFS hash
    depoID = await verifier.getDepositionFromIPFSHash(ipfsPic1);
    details = parseDetails(await verifierDB.getDetails(depoID));
    assert(details.state === StateEnum.Verified);
  });

  // don't allow short-changing on fees
  it('should not allow payment of a lower fee', async function(){
    var failure = false;
    try {
      var depositionID2 = deposition2.logs[0].args._deposition;
      var init = await verifier.initializeDeposition(depositionID2, ipfsPic2, deposition2.receipt.blockNumber, {from: verifier2, value: (fee/2)});
    } catch (error) {
      failure = true;
    }
    assert(failure);
  });

  // allow over-payment of fees
  it('should allow payment of a higher fee', async function(){
    var depositionID2 = deposition2.logs[0].args._deposition;
    var init = await verifier.initializeDeposition(depositionID2, ipfsPic2, deposition2.receipt.blockNumber, {from: verifier2, value: (fee*2)});
    assert(init.logs[0].event === 'DepositionPublished');
  });
  
  // Scenario: find out Proven status based only on IFPS hash, with no gas cost.
  it('should determine whether an image is proven solely given the IPFS hash', async function(){
    var depoID = await verifier.getDepositionFromIPFSHash(ipfsPic4);
    var details = parseDetails(await verifierDB.getDetails(depoID));
    assert(details.state === StateEnum.Proven);
  });

  // Should be able to see when the IPFS asset was first deposed ("proven")
  it('should record in which block the asset was first deposed', async function(){
    var depositionID3 = deposition3.logs[0].args._deposition;
    // Pass in the block number from the original deposition.
    // The request is being made by the same account that made the deposition.
    var init = await verifier.initializeDeposition(depositionID3, ipfsPic3, deposition3.receipt.blockNumber, {from: depositor3, value: fee});
    assert(init.logs[0].event === 'DepositionPublished');
    var details = parseDetails(await verifierDB.getDetails(depositionID3));
    assert(details.state === StateEnum.Initialized);
    assert(details.deposedInBlock === deposition3.receipt.blockNumber);
  });


  // Scenario: anonymous deposition, unchallenged verification, proven

  // Scenario: anon depo, verified by Alice, challenged by Bob, Alice wins, takes bond.

  // Scenario: anon depo, verified by Alice, challenged by Bob, Alice responds, Bob wins

  // Scenario: Alice verifies a new depo, Bob challenges, Alice responds, Bob wins

  // Scenario: Alice verifies a new depo, Bob challenges, Alice does not respond, Bob wins

});
/*
    var watcher = bondHolder.Debug();
    watcher.watch((err, e) => {
      console.log('******* debug *******');
      console.log(err);
      console.log(e);
    });
*/
