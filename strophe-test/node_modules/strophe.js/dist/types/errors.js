class SessionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'StropheSessionError';
    }
}
export { SessionError };
