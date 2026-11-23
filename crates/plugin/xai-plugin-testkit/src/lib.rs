//! Test-only helpers: harness, conformance, admission and fault acceptance.
//!
//! Scaffold crate created by TASK-002. Modules are declared once here so that
//! later tasks only add module bodies instead of editing this file.
#![forbid(unsafe_code)]

pub mod admission;
pub mod conformance;
pub mod fault;
pub mod fault_acceptance;
pub mod fixtures;
pub mod fuzz;
pub mod harness;
pub mod security;
