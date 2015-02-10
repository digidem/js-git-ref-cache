module.exports = function addRefCache(repo, cache) {
  "use strict";

  var memCache = {};
  var ttl = 60000;
  var readRef = repo.readRef;
  if (readRef) repo.readRef = readRefCached;
  var updateRef = repo.updateRef;
  if (updateRef) repo.updateRef = updateRefCached;

  function readRefCached(ref, callback) {
    // First check whether we have cached the ref in memory
    var hash = readMemCache(ref);
    if (hash) return callback(null, hash);

    // Check ref in origin repo
    readRef.call(repo, ref, onReadRef);

    function onReadRef(err, hash) {
      if (err) {
        // If there is a problem connecting to the origin repo
        // then read the reference in the cache
        cache.readRef(ref, callback);
      } else {
        // If we do get the ref, cache it.
        memCache[ref] = {
          hash: hash,
          timestamp: Date.now()
        };
        cache.updateRef(ref, hash, function(err) {
          callback(err, hash);
        });
      }
    }
  }

  // This serves to rate limit requests to the server for the same hash
  function readMemCache(ref) {
    if (!memCache[ref]) return;
    var age = Date.now() - memCache[ref].timestamp;
    if (age < ttl) return memCache[ref].hash;
    return;
  }

  function updateRefCached(ref, hash, callback) {
    updateRef.call(repo, ref, hash, onUpdateRef);

    function onUpdateRef(err) {
      if (err) return callback(err);
      // Update the cache to match the remote
      memCache[ref] = {
        hash: hash,
        timestamp: Date.now()
      };
      cache.updateRef(ref, hash, callback);
    }
  }
};
