---
layout: post
title:  "Tiny JavaScript observer snippet"
categories:
    - javascript
    - snippet
---

Once in a while you stumble across those tiny snippets of code
that ends up being a part of your project scaffolding.

I recently found one of these awesome snippets while browsing
github for cool projects.

Its name is [MicroEvent][microevent] and is a tiny observer type
event system for javascript.

It handles all your eventing for small projects and libraries,
and fits in very few lines of code:
{% highlight js %}
var MicroEvent = function() {};
MicroEvent.prototype = {
    bind: function(event, fct) {
        this._events = this._events || {};
        this._events[event] = this._events[event] || [];
        this._events[event].push(fct);
    },
    once: function (event, fct) {
        var wrapper = function () {
            fct.apply(this, Array.prototype.slice.call(arguments, 0));
            this.unbind(event, wrapper);
        };
        this.bind(event, wrapper);
    },
    unbind: function(event, fct) {
        this._events = this._events || {};
        if (event in this._events === false) return;
        this._events[event].splice(this._events[event].indexOf(fct), 1);
    },
    trigger: function(event /* , args... */ ) {
        this._events = this._events || {};
        if (event in this._events === false) return;
        for (var i = 0; i < this._events[event].length; i++)
            this._events[event][i].apply(this, Array.prototype.slice.call(arguments, 1));
    }
};
MicroEvent.mixin = function(destObject) {
    var props = ['bind', 'unbind', 'trigger', 'once'];
    for (var i = 0; i < props.length; i++) {
        if (typeof destObject === 'function') {
            destObject.prototype[props[i]] = MicroEvent.prototype[props[i]];
        } else {
            destObject[props[i]] = MicroEvent.prototype[props[i]];
        }
    }
};
{% endhighlight %}

I added the `.once()` function since i use that a lot. I never had the need for an `.unonce()`
but that would also be fairly easy to implement.

And you add the MicroEvent mixins to your prototype with

{% highlight js %}
function GameState () {
    var mySecretGameState = {};
}
MicroEvent.mixin(GameState);
{% endhighlight %}


I think this is one of those pieces of code that makes you feel all warm and fuzzy inside. :)


[microevent]:    https://github.com/jeromeetienne/microevent.js
