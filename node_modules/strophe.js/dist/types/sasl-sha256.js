var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import SASLMechanism from './sasl';
import scram from './scram';
class SASLSHA256 extends SASLMechanism {
    constructor(mechname = 'SCRAM-SHA-256', isClientFirst = true, priority = 70) {
        super(mechname, isClientFirst, priority);
    }
    test(connection) {
        return connection.authcid !== null && scram.supported();
    }
    onChallenge(connection, challenge) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield scram.scramResponse(connection, challenge, 'SHA-256', 256);
        });
    }
    clientChallenge(connection, test_cnonce) {
        return scram.clientChallenge(connection, test_cnonce);
    }
}
export default SASLSHA256;
