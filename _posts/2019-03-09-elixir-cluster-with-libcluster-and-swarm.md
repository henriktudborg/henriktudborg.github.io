---
layout: post
title:  "Elixir Cluster with libcluster and swarm"
categories:
  - erlang
  - elixir
  - distributed
---

Recently I've been toying with automatically clustering Elixir nodes.

I wanted to be able to dynamicially add and remove Kubernetes pods
that would automatically join a cluster.

[`libcluster`][libcluster] provides this functionality, but the docs could use some love
(which they will get, if I find some extra time).

In this cluster, I needed a global process registry.
As I used to do Erlang, i reached for [`:gproc`][gproc] without much thought,
but while toying with [`libcluster`][libcluster] I stumpled upon [`swarm`][swarm] which I am now trying out as well.


- I use [Docker for Mac][docker-for-mac] and it's built in kubernetes feature for testing,
  but you can use a regular [Minikube][minikube] with minor modifications.
- I assume you already know docker and kubernetes basics.
- I am using Elixir 1.9.1 and the new [built-in release tooling][mix-release].

You can find the example project here: [https://github.com/tbug/elixir_cluster_demo](https://github.com/tbug/elixir_cluster_demo)

## Goal

Creating a demo project that auto-clusters with libcluster on kubernetes.
We'll start by using Kubernetes DNS to discover our pods.


## Creating the project

```
$ mix new elixir_cluster_demo --sup
```

and add `libcluster` and `swarm` to dependencies,
my MixProject now looks like this:

```elixir
defmodule ElixirClusterDemo.MixProject do
  use Mix.Project

  def project do
    [
      app: :elixir_cluster_demo,
      version: "0.1.0",
      elixir: "~> 1.9",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger],
      mod: {ElixirClusterDemo.Application, []}
    ]
  end

  defp deps do
    [
      {:libcluster, "~> 3.1"}, # added
      {:swarm, "~> 3.0"},      # added
    ]
  end
end
```


I then modify my application file to start `libcluster`'s `Cluster.Supervisor`:

```elixir
defmodule ElixirClusterDemo.Application do
  use Application

  def start(_type, _args) do
    children = [
      {Cluster.Supervisor, [
        Application.get_env(:libcluster, :topologies),
        [name: ElixirClusterDemo.ClusterSupervisor]
      ]},
      # ... your own children here
    ]
    Supervisor.start_link(children, strategy: :one_for_one, name: ElixirClusterDemo.Supervisor)
  end
end
```

And add a couple of config files to configure my topology:

```elixir
# config/config.exs
import Config
import_config "#{Mix.env()}.exs"


# config/prod.exs
import Config

config :libcluster,
  topologies: [
    topology: [
      strategy: Cluster.Strategy.Kubernetes.DNS,
      config: [
        service: "elixir-cluster-demo",
        application_name: "elixir_cluster_demo",
      ]
    ]
  ]

# This will exclude all of our remote shells, observers, etc:
config :swarm,
  node_whitelist: [~r/^elixir_cluster_demo@.*$/]
```


## Setting up release

First we'll use mix to generate some release configuration files:

```
$ mix release.init
```

And then we customize the `rel/env.sh.eex` file:

```sh
# rel/env.sh.eex
export RELEASE_DISTRIBUTION=name
export RELEASE_NODE=<%= @release.name %>@$(hostname -i)
```

See https://hexdocs.pm/libcluster/Cluster.Strategy.Kubernetes.DNS.html for why
we use `hostname -i` instead of the FQDN.


We'll need an image to spawn in kubernetes,
so let's create a Dockerfile:

```Dockerfile
FROM elixir:1.9.1-alpine AS build
WORKDIR /app
ENV MIX_ENV=prod
RUN mix local.hex --force \
    mix local.rebar --force
# Copy deps and mix file in first
# to cache dep compilation
COPY deps mix.exs ./
RUN mix deps.compile
COPY . .
RUN mix release

FROM elixir:1.9.1-alpine
WORKDIR /app
COPY --from=build /app/_build/prod/rel/elixir_cluster_demo /app
CMD ["/app/bin/elixir_cluster_demo", "start"]
```

I also have a `.dockerignore` file that looks like this:

```
_build/
```

just to avoid copying over our local `_build` files each time.


Build the image with

```
$ docker build -t elixir-cluster-demo:latest .
```

We should now have our image.

```
$ docker images
REPOSITORY                           TAG                 IMAGE ID            CREATED             SIZE
elixir-cluster-demo                  latest              21cc505759db        About an hour ago   98.1MB
```

Since this image is already available inside Docker for Mac I don't
need to do anything else.

If your kubernetes cluster is located elsewhere you'll need to push the
image to a container registry available to the kubernetes cluster.


## Kubernetes Configuration

The kubernetes config is very simple.

We are going to create a deployment to manage replica-set and pods for us,
and a ["headless" service][headless-service] to allow us to discover
our cluster nodes via DNS (I'm using the default CoreDNS).

Here are two objects we need (defined in the same file)

```yaml
# k8s.yml
apiVersion: v1
kind: Service
metadata:
  name: elixir-cluster-demo
spec:
  selector:
    app: elixir-cluster-demo
  clusterIP: None # "headless" service
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: elixir-cluster-demo
  labels:
    app: elixir-cluster-demo
spec:
  replicas: 3
  selector:
    matchLabels:
      app: elixir-cluster-demo
  template:
    metadata:
      labels:
        app: elixir-cluster-demo
    spec:
      containers:
      - name: elixir-cluster-demo
        image: elixir-cluster-demo:latest
        imagePullPolicy: Never # to pick up Docker for Mac images built
```

And to apply the objects:

```
$ kubectl apply -f k8s.yml
```

We should now have 3 pods (and containers) running with our image,
and a service that manages the DNS A records on the given service name.


You can check that the DNS works:

```
$ kubectl run my-dns-test-pod -ti --restart=Never --rm --image=alpine -- sh
/ # apk add bind-tools
/ # dig +short elixir-cluster-demo.default.svc.cluster.local
10.1.0.66
10.1.0.65
10.1.0.67
/ # ^D
/ # pod "my-dns-test-pod" deleted
pod default/my-dns-test-pod terminated (Error)
```

You can try deleting some pods and check again to see how the DNS changes (but not instantly) over time.

## Cluster Node Output

If all went will you should see something like this in the pod logs:

```
16:15:25.758 [info]  [swarm on elixir_cluster_demo@10.1.0.69] [tracker:init] started
16:15:25.775 [info]  [libcluster:topology] connected to :"elixir_cluster_demo@10.1.0.65"
16:15:25.776 [info]  [swarm on elixir_cluster_demo@10.1.0.69] [tracker:ensure_swarm_started_on_remote_node] nodeup elixir_cluster_demo@10.1.0.65
16:15:25.793 [info]  [libcluster:topology] connected to :"elixir_cluster_demo@10.1.0.67"
16:15:25.806 [info]  [swarm on elixir_cluster_demo@10.1.0.69] [tracker:ensure_swarm_started_on_remote_node] nodeup elixir_cluster_demo@10.1.0.67
16:15:30.724 [info]  [swarm on elixir_cluster_demo@10.1.0.69] [tracker:cluster_wait] joining cluster..
16:15:30.724 [info]  [swarm on elixir_cluster_demo@10.1.0.69] [tracker:cluster_wait] found connected nodes: [:"elixir_cluster_demo@10.1.0.67", :"elixir_cluster_demo@10.1.0.65"]
16:15:30.724 [info]  [swarm on elixir_cluster_demo@10.1.0.69] [tracker:cluster_wait] selected sync node: elixir_cluster_demo@10.1.0.67
```

Great, we now have a cluster.

## Swarm as a process registry

Swarm can be used as a regular process registry.
Using this Counter example:

```elixir
defmodule ElixirClusterDemo.Counter do
  use Agent

  def start_link(name, val) do
    Agent.start_link(fn -> val end, name: via_swarm(name))
  end

  def value(name) do
    Agent.get(via_swarm(name), &(&1))
  end

  def increment(name) do
    Agent.update(via_swarm(name), &(&1 + 1))
  end

  defp via_swarm(name) do
    {:via, :swarm, name}
  end
end
```

On one of our nodes:

```
iex(elixir_cluster_demo@10.1.0.80)1> ElixirClusterDemo.Counter.start_link(:my_proc, 0)
{:ok, #PID<0.881.0>}
```

On a different node, try to register the same process again:

```
iex(elixir_cluster_demo@10.1.0.81)1>  ElixirClusterDemo.Counter.start_link(:my_proc, 0)
{:error, {:already_started, #PID<28548.881.0>}}
```

And we can call our process from any of the nodes:

```
iex(elixir_cluster_demo@10.1.0.82)1> ElixirClusterDemo.Counter.value(:my_proc)
0
iex(elixir_cluster_demo@10.1.0.82)2> ElixirClusterDemo.Counter.increment(:my_proc)
:ok
iex(elixir_cluster_demo@10.1.0.82)3> ElixirClusterDemo.Counter.value(:my_proc)
1
```

```
iex(elixir_cluster_demo@10.1.0.81)1> ElixirClusterDemo.Counter.value(:my_proc)
1
iex(elixir_cluster_demo@10.1.0.81)2> ElixirClusterDemo.Counter.increment(:my_proc)
:ok
iex(elixir_cluster_demo@10.1.0.81)3> ElixirClusterDemo.Counter.value(:my_proc)
2
```

So there you have it. Cluster-wide process registry.


## Notes

I've had swarm deadlock on me multiple times in it's `:syncing` state.

Here is a state dump

```elixir
{:syncing,
 %Swarm.Tracker.TrackerState{
   clock: {1, 0},
   nodes: [:"elixir_cluster_demo@10.1.0.79", :"elixir_cluster_demo@10.1.0.78"],
   pending_sync_reqs: [#PID<28596.845.0>],
   self: :"elixir_cluster_demo@10.1.0.77",
   strategy: #<Ring[:"elixir_cluster_demo@10.1.0.79", :"elixir_cluster_demo@10.1.0.78", :"elixir_cluster_demo@10.1.0.77"]>,
   sync_node: :"elixir_cluster_demo@10.1.0.78",
   sync_ref: #Reference<0.4085255612.672137219.185792>
 }}
```

The `pending_sync_reqs` is never resolved for some reason. Haven't digged into why yet.
Having the node where that pid (`#PID<28596.845.0>`) is located on die resolves this, but it doesn't
seem to resolve itself.

This seem to happen when a lot of nodes (3 in this case) join at the same time (aka, killing all pods in a replica-set).


I probably won't be using Swarm until I figure out why this happens,
but I havn't had any problems with `libcluster` (unless this turns out to be one) so I'll probably be using that for auto-clustering my nodes
from now on.


[headless-service]: https://kubernetes.io/docs/concepts/services-networking/service/#headless-services
[mix-release]: https://hexdocs.pm/mix/Mix.Tasks.Release.html
[docker-for-mac]: https://docs.docker.com/docker-for-mac/
[minikube]: https://kubernetes.io/docs/tutorials/hello-minikube/
[gproc]: https://github.com/uwiger/gproc
[swarm]: https://github.com/bitwalker/swarm
[libcluster]: https://github.com/bitwalker/libcluster
