//! Protocol and DTO contract for native Yeah plugins (yeah-plugin/1.0).
//!
//! Scaffold crate created by TASK-002. Modules are declared once here so that
//! later tasks only add module bodies instead of editing this file.
#![forbid(unsafe_code)]

pub mod context;
pub mod error;
pub mod events;
pub mod manifest;
pub mod negotiation;
pub mod protocol;
pub mod redaction;
pub mod rpc_error;
pub mod state;
pub mod validation;
pub mod version;
