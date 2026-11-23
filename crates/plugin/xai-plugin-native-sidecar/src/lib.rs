//! Sidecar backend implementation behind the runtime NativeBackend boundary.
//!
//! Scaffold crate created by TASK-002. Modules are declared once here so that
//! later tasks only add module bodies instead of editing this file.
#![forbid(unsafe_code)]

pub mod backend;
pub mod fs_quota;
pub mod health;
pub mod net_quota;
pub mod process;
pub mod quota;
pub mod rpc;
pub mod sandbox;
pub mod shutdown;
pub mod terminate;
