import type Connection from './connection';
import SASLMechanism from './sasl';
declare class SASLOAuthBearer extends SASLMechanism {
    constructor(mechname?: string, isClientFirst?: boolean, priority?: number);
    test(connection: Connection): boolean;
    onChallenge(connection: Connection): string;
}
export default SASLOAuthBearer;
//# sourceMappingURL=sasl-oauthbearer.d.ts.map