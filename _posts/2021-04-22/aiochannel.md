---
layout: post
title: "aiochannel - Closable Queues for asyncio"
categories:
  - python
  - asyncio
---

Years ago when I still did a lot of python and when asyncio was fairly new,
I build [a library for closable queues][github] inspired by Go's channels.

I was recently cleaning up and reviewing my github repos and realized that
I have never actually written anything about aiochannel.

I can see that it still receives [some downloads][pypistats] so I guess
this is as good a time as any to write about why I think it's a useful library.

## aiochannel

Aiochannel is a small queue-like library built for [asyncio][asyncio] that adds
the ability to mark a queue as closed to be sure that no further items can be added.
This is really useful when you have a finite amount of "stuff" to work on.
The main class that aiochannel introduces is the `Channel`.

The implementation is similar to the [`asyncio.Queue`][asyncio.Queue] module also and mirrors it's API.
`Channel` introduces two new methods `close()` and `closed()`.
`close()` which marks the channel so that no further work can be `put()` onto it.
`closed()` simple returns `True` or `False` depending on if the queue is closed and drained or not.

Both the `Channel` and the `Queue` has a concept of being "finished",
but there are some key differences in how it behaves:

In the case of a `Queue` it is marked as "finished" when the queue size is exactly zero.
This "finished" state is the condition for `Queue`'s `join()`, so once the queue
size reaches 0, the queue joins. However, if work is later `put()` back onto the queue,
the finished state is un-set again.

`Channel` also joins once it is marked as "finished" but in contrast to `Queue` it is only marked "finished" when it is both drained and marked as closed, guaranteeing that no futher work can appear on the channel.
A `Channel`'s "finished" state can never be un-set and neither can it's `close` state.
This means that once a `Channel` joins you know that you've done all the work that could
ever appear on that `Channel` object.

In addition, a `Channel` does not have `Queue`'s `task_done()`. The signal for when
all work is completed is that the `Channel` joins, meaning it is closed and there are zero items left in the channel.

Because of this behaviour it's pretty intuitive how an `async for` would behave over
this object. The `async for` runs as log as there is possible work to do.
Once the `Channel` joins the loop is done.

This means that building a worker over the channel is trivially easy,
as you can just spawn the following code in a task:

```python
async for item in channel:
  await do_work(item)
# at this point the Channel is closed and empty
```

This is - in my opinion - a much better abstraction for most of the use-cases
where I'd otherwise reach for `asyncio.Queue` and some `Event` signals.

With a `Channel` you can't forget to mark work as done and you can't accidentally
race to having a `Queue` that has joined and then later received more work.

You can find `aiochannel` on [GitHub][github] and [PyPI][pypi].



[github]: https://github.com/tbug/aiochannel
[pypi]: https://pypi.org/project/aiochannel/
[pypistats]: https://pypistats.org/packages/aiochannel
[asyncio.Queue]: https://docs.python.org/3/library/asyncio-queue.html#asyncio.Queue
[asyncio]: https://docs.python.org/3/library/asyncio.html

