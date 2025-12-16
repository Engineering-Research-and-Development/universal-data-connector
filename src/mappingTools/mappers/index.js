/**
 * Protocol Mappers Index
 * 
 * Exports all available protocol mapper implementations.
 */

const OPCUAMapper = require('./OPCUAMapper');
const ModbusMapper = require('./ModbusMapper');
const AASMapper = require('./AASMapper');
const MQTTMapper = require('./MQTTMapper');
const GenericMapper = require('./GenericMapper');

module.exports = {
  OPCUAMapper,
  ModbusMapper,
  AASMapper,
  MQTTMapper,
  GenericMapper
};
