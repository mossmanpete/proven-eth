/*
Backend contract
Part of the Proven suite of software
Copyright (C) 2016 "The Partnership"
(Ethereum 0x12B0621D90c69867957A836d677C64c46EC4291D)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./ProvenRegistry.sol";


/// ProvenDb
/// Back-end storage contract for the Proven app.

contract ProvenDb is Ownable {

  event DepositionStored(bytes32 _deposition, address _deponent, bytes _ipfsHash);

  ProvenRegistry public registry;

  /// Collection of all depositions
  mapping(bytes32 => Deposition) public depositions;

  struct Deposition {
    address deponent;
    bytes ipfsHash;
  }

  modifier onlyProven() {
    require(msg.sender == registry.proven());
    _;
  }

  modifier onlyNewReceipt(bytes32 _id) {
    require(depositions[_id].deponent == 0);
    _;
  }

  /// Constructor
  function ProvenDb(address _registry) public {
    registry = ProvenRegistry(_registry);
  }

  function getDeponent(bytes32 _id) public view returns (address) {
    return depositions[_id].deponent;
  }

  function getIPFSHash(bytes32 _id) public view returns (bytes) {
    return depositions[_id].ipfsHash;
  }

  function storeDeposition(address _deponent, bytes _ipfsHash) public onlyProven returns (bytes32) {

    // generate hash to send back to caller
    bytes32 id = keccak256(msg.data, block.number);

    store(id, _deponent, _ipfsHash);

    return id;
  }

  function store(bytes32 _id, address _deponent, bytes _ipfsHash) internal onlyNewReceipt(_id) {

    var deposition = depositions[_id];

    deposition.deponent = _deponent;
    deposition.ipfsHash = _ipfsHash;

    DepositionStored(_id, _deponent, _ipfsHash);
  }
}
