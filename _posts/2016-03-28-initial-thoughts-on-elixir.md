---
layout: post
title:  "Initial Thoughts on Elixir"
categories:
  - elixir
  - phoenix
hidden: true
---

I've been interested in working with elixir ever since I first learned about it.
I've of course read the "Getting Started" and built the demo projects.
But playing around doesn't really tell you much about how it is
to do _real_ work with the language.

Luckily, the last couple of weeks I've been working on a project in
Elixir for [Billy][billy], which has been a nice way to
get some real Elixir experience and evaluate both the language,
community and ecosystem.

This _wont_ be a guide, tutorial or reference post.

This post will be about my experience getting set up with Elixir.
Developing a project and a library, and getting everything ready for
production in time for a deadline.

I'll be assuming that you know a bit about Elixir and it's tooling.


## Background

To understand my reasoning and some of the points I'll make,
it might be useful to know a bit about my programming background.
Professionally I've been doing mostly dynamic programming.  
PHP, Python and Javascript being the most used ones,
of which Python is (by far) my favorite.  

## Programming Elixir

I started a few weeks ago. At that time, my Elixir experience was still limited.
I had done the official "Getting Started" (a few times) and tinkered a bit
on a few side-projects, but that's about it.  
I knew the basics though, so I was fairly confident that it would
be easy to build a production system.


### Project requirements

The project is a read-model for a set of "things".
Each "thing" has it's own ongoing stream of events which needs to be
denormalized and indexed in the read model so it can be queried via
an API (HTTP) which the project also serves. The "thing"-data is available
via a set of thrift services, and the actual streams are served by
[eventstore](EventStore). Finally, Elasticsearch is used as the read-model storage.

So:

- Read events from EventStore
- Denormalize with data fetched via thrift services
- Insert into Elasticsearch
- Serve HTTP API capable of querying that data


I `mix new`-ed and were on my way.

### Dependencies


#### Web Server

I ofc. wanted to find libraries for as many of the services I needed
to communicate with, and a HTTP server library.

The obvious web server library choice at the moment is probably [Phoenix][phoenix].
I previously played around with Phoenix, but I don't
think it's optimal for creating tiny APIs (yet, at least).

I decided to try just using [Plug][plug] (which Phoenix is built on).
This went fine at first, but a few hours in I
realized that my life would be so much easier if I had some sugar on top.
So, after a bit of googling for that sugar without much success, I gave Phoenix another chance. 

Phoenix contains all the stuff that you'll "probably need", but
also a ton of other stuff you definitely won't need for a tiny API server.
This would be a non-issue if Phoenix had better documentation,
but - at least in my opinion - finding what you need is up-hill,
especially if you don't know exactly what you are looking for.

(Sidenote: Syntax highlighting is _still_ missing from the Phoenix guides?!)

The Phoenix guides seem to be written for a very specific kind
of application, which is definitely not a thin HTTP API with a handful of endpoints.  
The [documentation][phoenixdoc] is great as a reference,
but when you don't know what you are looking for, less so.

So for a production web framework,
Phoenix seems to be the safe choice for now.
Even for HTTP API projects.


### Elasticsearch

Once again, the [available options][hexelasticsearch] are a bit limited.
The only real options here is [Tirexs][tirexs].

I went with Tirexs hoping that it would be faster than building it myself.

Tirexs uses Elixir macros to build an Elasticsearch DSL. It is used for
everything from defining mappings to searching for documents.

I'm not a fan of heavy macro use,
but as the Github page for Tirexs passive-aggressively points out:

> ## Not sure?
> Look around using https://hex.pm/packages?search=elasticsearch
> to find out some other packages.

Tirexs _is_ the only somewhat used Elasticsearch library in hex,
so the only real options here were:

- Use [Tirexs][tirexs]
- Build it yourself

So I went with Tirexs.

#### Macro Rant

Tirexs' use of macros goes way beyond what makes sense.
I know this is personal preference, but the few lines I save writing code
is added and multiplied to the complexity of understand what these macros hide.
The DSL doesn't really add anything except a few lines saved,
and I ended up having to read the source to understand what was going on.
Using Keyword lists or Maps structured like Elasticsearch expects the data would have been easier.

There is no real DSL documentation, so you'll have to go read the source.
Actually, there isn't really any documentation at all outside of the source.
If your use case is not in any of the examples, you are out of luck.
To Tirexs' credit, the source is now fairly well documented, so It isn't _that_
hard to read it once you find what you are looking for.
The upcomming version `0.8` adds a ton of source docs, and the code is also
way easier to read and understand. Sadly, due to my own deadlines,
I'm stuck with `0.7`.

If you need to talk to Elasticsearch, Tirexs is probably the way to go,
but you'll probably have to read the source to understand how to use it,
or wait until a later release that adds more docs (and some `hexdocs.pm`)
Hopefully this will happen in `>= 0.8`.


### EventStore

If you are not familiar with [EventStore][eventstore],
It is a database for storing events in streams, and it comes with
built-in projections (written as Javascript).
very useful if you are doing event sourcing work.

Because EventStore isn't very popular (yet!), and Elixir is fairly new,
I didn't expect to find any good libraries.

In fact, if you [search for "eventstore" on hex][hexeventstore], you'll find

- Someones implementation of storing events using postgres as a backend,
- Extreme, a TCP client for EventStore
- My HTTP client for EventStore, which I wrote to reach that deadline :)

Initially I went with [Extreme][extreme], as it looked decently documented.
However, as the deadline aproached, I needed some very specific things
from EventStore, and it wasn't documented. I could have probably figured it out,
but the lack of documentation of Extreme, _and_ the terrible documentation of the
EventStore TCP protocol made me jump ship.

The EventStore HTTP is _somewhat_ documented, at least much more than the
TCP protocol, _and_ it is the "recommended" way to interface with EventStore
outside of high-throughput/low-latency requirements.

So I ended up building a [client][eventstorehttpclient] around [HTTPoison][httpoison] to interface with EventStore via HTTP.
I'm not super happy with the API yet, but, Elixir newbie, deadlines, and other excuses. :)  
On the bright side, I now know how to publish packages on hex.pm (which is _super_ easy, btw)

So here, I ended up writing my own library.


### Thrift

Obviously, a good thrift Elixir (or Erlang) library must exist, Right?  
Well, If you [search for "thrift"][hexthrift] on hex you get _one_ package:
[Elixir Thrift][elixirthrift] from Pinterest.

This package contains a copy of the official erlang thrift library, and a mix task to
compily thrift files as part of the mix compile list.

When I started using it, it didn't allow me to manually specify the `--gen` argument
to `thrift`, which I needed as I wanted to run it as `--gen erl:maps` to get Map support.
I made a Pull Request with what I needed (and broke everything in the process. Multiple times. Still embarrassed about that. Sorry Elxir Thrift maintainer :( )

After that, everything worked fairly smoothly. Of course the Erlang thrift library returns
Records, which is a true pain to work with in Elixir compared to Structs.
And wrapping everything up in a nice API so the rest of the code doesn't have to worry
about Records, thrift, pooling, etc. Took longer then expected.

I later discovered [Riffed][riffed] which I regret not finding sooner as it provides
exactly what I needed.
I'll probably rewrite to Riffed when I get the chance.

Working with thrift was painful (as always) but probably
the most predictable of the requirements.

So definitely OK, and maybe even pleasant when using Riffed.


## Getting ready for deployment

The project is deployed using [Marathon][marathon], so I needed to package it up in a Docker image.
At [Billy][billy] we use self-hosted [Drone][drone] for CI,
so writing a `Dockerfile` and a `.drone.yml` was all it took to get working.
I based my Dockerfile on the "official" [Elixir image][elixirimage],
which apart from `git`, `hex` and `rebar` already contained the dependencies I needed.

After the container is built, we run `mix test` in the container, and if everything passes,
we tag the container with the commit hash and branch name, and push to our private docker registry.

The application is started by `mix phoenix.server` (with `MIX_ENV=prod`) and that's about it.
I'd love to try out releases sometime, but once again, deadlines.


## Conclusion

### Libraries

Finding good libraries is hard!
The options available is still quite limited, and the ones available is almost always
terribly documented (and I'm not pointing fingers, My library lacks documentation as well).
So expect to spend _way_ more time then you'd think, reading the source to figure out
what your library is doing and how it works.

### Development Time

I noticed how my time estimates have been significantly off.
Possibly because I'm still not that experienced with Elixir,
but I also think it's something else.
I spend more time on specific parts in Elixir, than I would in e.g. Python.
But _less_ time _after_ I think it's "done", on debugging, correcting for changed requirements, etc.

Hopefully, this holds up when requirements change and we have to update the project.

### Versioning issues

I've been bitten a few times by package version conflicts,
especially the most common packages like JSON, UUID and similar.
I know this pain from Python but I didn't expect to meet it in Elixir.

The issue is that some packages depends on `SomeJsonLib 1.0` and others on `SomeJsonLib 2.0`,
but as they are both called `SomeJsonLib` you can only install one of them.
I havn't found a way around this,
and I don't even know how a way around this would work.

Someone smarter than me will hopefully find a way.
Alternatively, library authors will have to support all versions of a library,
which will be a pain, especially if you need `some-new-feature` only available in `SomeJsonLib 2.0`.

Or maybe we just have to accept that you don't break backwards compatibility in your packages, and
authors will accept `YourPackage >= version`.  
This doesn't seem right though.

I don't know. ¯\\\_(ツ)\_/¯

### All glory to IEx

Another thing I have to mention is how wonderfully easy it is to try out new things.
I've used `iex -S mix` countless times to check out the docs for a function or module (`h <function>`),
or test something out in Elixir to see how it works.

My usual languages also provide a REPL-like functionality, but nowhere near the power of IEx.
Running your applications and talking to your modules, inspecting their state, and actually being able
to poke around the system while it is running is priceless.

I can see how being able to attach to a running production system to debug that one error caused by some bad state that takes down your entire service, but only shows up in production, and only once every month or so, being a huge help.

I've tried debugging these things in Python, and you'll need a ton of instrumentation to catch everything.
In Elixir and Erlang, you can just attach after the fact, and figure out where the bad state is.

### Supervision

Supervisors are amazing, everyone seems to agree on that, so I won't circlejerk to much here.  
I _will_ however note that if you are like me, you will need to spend a lot of time at first, thinking about it. Getting supervision trees right is something I found very hard at first, and I probably ended up overusing supervisors.


### TL;DR

**Will I use Elixir for new projects?**  
Yes, but it will depend more on the quality of the required libraries then the language.

**Was Elixir the right fit for this project, instead of using node as usual?**  
Probably not, no. With a more flexible deadline, maybe.

**Was Elixir more enjoyable then using node?**  
Very much so, yes. Even with the deadline breathing down my neck.



[eventstore]: https://geteventstore.com/
[phoenix]: http://www.phoenixframework.org/
[phoenixdoc]: https://hexdocs.pm/phoenix
[plug]: https://github.com/elixir-lang/plug
[readme.io]: https://readme.io/
[hexelasticsearch]: https://hex.pm/packages?search=elasticsearch&sort=downloads
[tirexs]: https://github.com/Zatvobor/tirexs
[googlecqrs]: https://www.google.com/search?q=CQRS
[hexeventstore]: https://hex.pm/packages?search=eventstore&sort=downloads
[extreme]: https://github.com/exponentially/extreme
[httpoison]: https://github.com/edgurgel/httpoison
[eventstorehttpclient]: https://github.com/tbug/elixir-eventstore-http-client
[hexthrift]: https://hex.pm/packages?search=thrift&sort=downloads
[elixirthrift]: https://github.com/pinterest/elixir-thrift
[riffed]: https://github.com/pinterest/riffed
[billy]: https://billy.dk
[drone]: https://drone.io/
[marathon]: https://mesosphere.github.io/marathon/
[elixirimage]: https://hub.docker.com/_/elixir/
