# COMP 422 - Algorithm Project

### *Anthony Constantinescu, George Rule, Josh Burick, Lucas Sanderson*

## Our Problem: *"The Greedy Raccoon"*

This is is a modified version of the traveling repairman problem, in which a path must be selected through a graph of varying-distance nodes such that the sum of the waiting times for each node is the smallest possible. The problem consists of a list of food items that each have an XY position on a fixed-size 2D plane, and a type. Each type (e.g. pizza, fish), has a caloric value and a decay rate. Once a food item is eaten, it’s gone. The goal of the raccoon is to travel a path that results in the maximum caloric intake with the least spoiled food. The score of a given path that the raccoon takes is determined by each food item as follows:

* The score is increased proportional to how much caloric value the item has.
* The score is decreased if the item is spoiled.

The path with the highest possible score wins. Assume for simplicity’s sake that the raccoon can travel in a straight line towards the desired food item, to avoid layering a spatial pathfinding algorithm on top of this problem.

## Our Solutions

We will implement two solution algorithms.

* ### Easy (Greedy Algorithm):
    At the starting position (and after consuming a food item), look at all remaining food items. Calculate an attractiveness for each item, something like:
    attractiveness = decay rate * (freshness upon arrival / calories).
    Then navigate to and consume the item with the highest attractiveness. This approach is based on “instant gratification” (however, with the decay rate multiplier causing the raccoon to prioritize items that won’t last much longer). This gives a baseline for our second algorithm to beat.

* ### Hard (Dynamic Programming):
    We will implement a “Modified TSP Dynamic Programming (Held-Karp)”. This would be much more complex to code but could result in a more optimal solution because dynamic programming can calculate an entire path ahead of time instead of taking decisions in the moment like our greedy algorithm.


## Viewing the Solutions
## *Implementation in progress*
