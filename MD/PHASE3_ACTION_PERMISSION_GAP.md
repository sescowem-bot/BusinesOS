# Phase 3 — Core action-level role permissions (not yet deployed)

The existing plan system grants eight core modules to every business and all its published plans, while premium feature/role grants are maintained separately. This is why Free previously showed `Direct modules: None` in the audit. That was a misleading label, not a missing Free plan.

The current plan permission editor only configures premium module access. It does not centrally configure granular core permissions such as create, read, update, delete, publish, approve, export and manage for each named staff role.

A Salem-style unified permission system still needs: a reviewed migration for tenant-scoped roles, a feature-action permission registry, default Free/paid role policy, superadmin controlled plan defaults, per-business role customizations restricted to the plan, explicit owner protection, service-RPC authorization, RLS enforcement, audit log for each change, and regression / cross-tenant tests before enabling writes. **Do not infer authorization from this read-only audit UI.**
