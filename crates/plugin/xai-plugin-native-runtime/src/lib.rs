//! Host-side runtime that owns gate, state machine, supervisor and adapter wiring.
//!
//! Scaffold crate created by TASK-002. Modules are declared once here so that
//! later tasks only add module bodies instead of editing this file.
#![forbid(unsafe_code)]

pub mod asset;
pub mod audit;
pub mod command_adapter;
pub mod effects;
pub mod event_budget;
pub mod event_bus;
pub mod event_dedup;
pub mod gate;
pub mod kill_switch;
pub mod lease;
pub mod lifecycle;
pub mod policy;
pub mod prompt_resource;
pub mod provider_registry;
pub mod provider_transform;
pub mod registry;
pub mod reload;
pub mod resource_adapter;
pub mod resource_guard;
pub mod shutdown_budget;
pub mod state_store;
pub mod supervisor;
pub mod tool_adapter;
pub mod trust;
