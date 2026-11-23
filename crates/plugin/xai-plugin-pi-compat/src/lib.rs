//! Branch-A compatibility host; loads upstream cdylib assets through the pi-rust ABI.
//!
//! Scaffold crate created by TASK-002. Modules are declared once here so that
//! later tasks only add module bodies instead of editing this file.
#![forbid(unsafe_code)]

pub mod abi_shim;
pub mod api_shim;
pub mod event_map;
pub mod host;
pub mod resource_map;
pub mod support_matrix;
