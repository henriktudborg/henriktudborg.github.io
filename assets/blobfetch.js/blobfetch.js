/***
BlobFetch by Henrik Tudborg <henrik@tudb.org>
http://tudb.org
Public Domain, but be kind and leave this comment.
***/

(function () {
    //attach to window if define is not found on window
    var define = (window && window.define) || function (_, p) {window.BlobFetch = p.call();};

    define([], function () {
        function BlobFetch (cfg, onSuccessShortcut, onErrorShortcut) {
            var self = this;
            if (typeof cfg === 'string') {
                cfg = {
                    url: cfg,
                    expect: undefined,          //expected type, either as a string or regex
                    load: undefined,            //called when blob loads without abort call
                    success: onSuccessShortcut, //called when blob loads successfully (and matches expected)
                    error: onErrorShortcut,     //called when error occurs
                    abort: undefined,           //called when abort is called
                    autostart: true             //fetching will start immediately
                };
            }
            //default autostart to true
            if (cfg.autostart === undefined) cfg.autostart = true;

            //internals
            var response, progress = -1, loaded = 0, total = -1;
            //timings
            var start, end;

            //event handlers
            var onprogress = cfg.progress,onsuccess = cfg.success, onload = cfg.load;
            //fallbacks for the error handlers when you forget to provide them.
            var onerror = cfg.error || function (self, ev) { return console && console.warn("blobfetch error", ev); };
            var onabort = cfg.abort || function (self, ev) { return console && console.info("blobfetch aborted"); };

            //set up xhr
            var xhr = new XMLHttpRequest();
            xhr.open('GET', cfg.url, true);
            xhr.responseType = 'blob';

            //set up event listeners
            xhr.addEventListener('progress', function (ev) {
                loaded = ev.loaded;
                if (ev.lengthComputable) {
                    total = ev.total;
                    progress = ev.loaded / ev.total;
                }
                if (onprogress) {
                    onprogress.call(self, ev);
                }
            }, false);
            xhr.addEventListener('load', function (ev) {
                progress = 1;
                loaded = total = xhr.response.size;
                response = xhr.response;
                end = new Date().getTime();
                var xhrOK = xhr.status >= 200 && xhr.status < 300;
                if (xhrOK && (!cfg.expect || response.type.match(cfg.expect))) {
                    if (onsuccess) onsuccess.call(self, ev);
                }
                else {
                    if (onerror) onerror.call(self, new TypeError('response did not match expected type'), ev);
                }
                if (onload) {//always call onload
                    onload.call(self, ev);
                }
            }, false);
            xhr.addEventListener('error', function (ev) {
                end = new Date().getTime();
                if (onerror) {
                    onerror.call(self, ev);
                }
            }, false);
            xhr.addEventListener('abort', function (ev) {
                end = new Date().getTime();
                if (onabort) {
                    onabort.call(self, ev);
                }
            }, false);

            //read-only methods
            Object.defineProperty(this, 'start', {
                get: function () { return function () {
                    start = new Date().getTime();
                    xhr.send();
                }; }
            });
            Object.defineProperty(this, 'abort', {
                get: function () { return function () {
                    xhr.abort();
                }; }
            });

            //read-only properties
            Object.defineProperty(this, 'url', {
                get: function () { return cfg.url; }
            });
            Object.defineProperty(this, 'progress', {
                get: function () { return progress; }
            });
            Object.defineProperty(this, 'bytesLoaded', {
                get: function () { return loaded; }
            });
            Object.defineProperty(this, 'bytesTotal', {
                get: function () { return total; }
            });
            Object.defineProperty(this, 'complete', {
                get: function () { return progress===1; }
            });
            Object.defineProperty(this, 'loadTime', {
                get: function () { if (progress===1) return end-start; else return undefined; }
            });
            Object.defineProperty(this, 'response', {
                get: function () { return response; }
            });
            Object.defineProperty(this, 'status', {
                get: function () { return xhr.status; }
            });
            Object.defineProperty(this, 'statusText', {
                get: function () { return xhr.statusText; }
            });

            //properties
            Object.defineProperty(this, 'onprogres', {
                get: function () { return onprogres; },
                set: function (x) { onprogres = x; },
            });
            Object.defineProperty(this, 'onload', {
                get: function () { return onload; },
                set: function (x) { onload = x; },
            });
            Object.defineProperty(this, 'onerror', {
                get: function () { return onerror; },
                set: function (x) { onerror = x; },
            });
            Object.defineProperty(this, 'onabort', {
                get: function () { return onabort; },
                set: function (x) { onabort = x; },
            });

            //usually we just want to start loading right away
            if (cfg.autostart) {
                this.start();
            }
        }

        return function () {
            return new BlobFetch(arguments[0],arguments[1],arguments[2]);
        };
    });
}());