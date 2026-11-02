import SASLMechanism from './sasl';
class SASLExternal extends SASLMechanism {
    constructor(mechname = 'EXTERNAL', isClientFirst = true, priority = 10) {
        super(mechname, isClientFirst, priority);
    }
    onChallenge(connection) {
        return connection.authcid === connection.authzid ? '' : connection.authzid;
    }
}
export default SASLExternal;
