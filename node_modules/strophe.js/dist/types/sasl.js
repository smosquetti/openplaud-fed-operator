/**
 * Encapsulates an SASL authentication mechanism.
 *
 * User code may override the priority for each mechanism or disable it completely.
 * See <priority> for information about changing priority and <test> for informatian on
 * how to disable a mechanism.
 *
 * By default, all mechanisms are enabled and t_he priorities are
 *
 *     SCRAM-SHA-512 - 72
 *     SCRAM-SHA-384 - 71
 *     SCRAM-SHA-256 - 70
 *     SCRAM-SHA-1   - 60
 *     PLAIN         - 50
 *     OAUTHBEARER   - 40
 *     X-OAUTH2      - 30
 *     ANONYMOUS     - 20
 *     EXTERNAL      - 10
 *
 * See: {@link Strophe.Connection#registerSASLMechanisms}
 */
class SASLMechanism {
    /**
     * PrivateConstructor: Strophe.SASLMechanism
     * SASL auth mechanism abstraction.
     * @param name - SASL Mechanism name.
     * @param isClientFirst - If client should send response first without challenge.
     * @param priority - Priority.
     */
    constructor(name, isClientFirst, priority) {
        this.mechname = name;
        this.isClientFirst = isClientFirst;
        this.priority = priority;
        this._connection = null;
    }
    /**
     * Checks if mechanism able to run.
     * To disable a mechanism, make this return false;
     *
     * To disable plain authentication run
     * > Strophe.SASLPlain.test = function() {
     * >   return false;
     * > }
     *
     * See <SASL mechanisms> for a list of available mechanisms.
     * @param _connection - Target Connection.
     * @returns If mechanism was able to run.
     */
    test(_connection) {
        return true;
    }
    /**
     * Called before starting mechanism on some connection.
     * @param connection - Target Connection.
     */
    onStart(connection) {
        this._connection = connection;
    }
    /**
     * Called by protocol implementation on incoming challenge.
     *
     * By deafult, if the client is expected to send data first (isClientFirst === true),
     * this method is called with `challenge` as null on the first call,
     * unless `clientChallenge` is overridden in the relevant subclass.
     * @param _connection - Target Connection.
     * @param _challenge - current challenge to handle.
     * @returns Mechanism response.
     */
    onChallenge(_connection, _challenge) {
        throw new Error('You should implement challenge handling!');
    }
    /**
     * Called by the protocol implementation if the client is expected to send
     * data first in the authentication exchange (i.e. isClientFirst === true).
     * @param connection - Target Connection.
     * @returns Mechanism response.
     */
    clientChallenge(connection) {
        if (!this.isClientFirst) {
            throw new Error('clientChallenge should not be called if isClientFirst is false!');
        }
        return this.onChallenge(connection);
    }
    /**
     * Protocol informs mechanism implementation about SASL failure.
     */
    onFailure() {
        this._connection = null;
    }
    /**
     * Protocol informs mechanism implementation about SASL success.
     */
    onSuccess() {
        this._connection = null;
    }
}
export default SASLMechanism;
