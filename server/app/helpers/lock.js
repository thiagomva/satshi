const { EventEmitter } = require('events');

class Lock {
  constructor() {
    this._locked = {};
    this._ee = new EventEmitter();
  }

  acquire(user) {
    return new Promise(resolve => {
      if (!this._locked[user]) {
        this._locked[user] = true;
        return resolve();
      }
      
      const tryAcquire = (user) => {
        if (!this._locked[user]) {
          this._locked[user] = true;
          this._ee.removeListener('release_'+user, () => tryAcquire(user));
          return resolve();
        }
      };
      this._ee.on('release_'+user, () => tryAcquire(user));
    });
  }

  release(user) {
    this._locked[user] = false;
    setImmediate(() => this._ee.emit('release_'+user));
  }
}

module.exports = Lock;