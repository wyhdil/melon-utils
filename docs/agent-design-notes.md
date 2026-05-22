# Agent Design Notes

## Goal

Build a Melon-focused agent that can understand user requests, route them to the right Melon workflow, and return a useful structured result.

## First Workflow

Given an artist or group name, find the latest album and output its track/source list in the expected source format.

## Boundaries

- The current project does not assume a Melon data source yet.
- The source payload format is a placeholder until the expected final format is provided.
- The agent is initialized as a CLI first so workflows can be tested before adding a web UI or service API.
