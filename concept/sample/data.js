window.FTM_DATA = {
  "sample": true,
  "generatedAt": "2026-10-13T08:59:42.152Z",
  "project": "twoseats",
  "providers": [
    {
      "id": "github",
      "name": "GitHub",
      "account": "your-login",
      "plan": "Free",
      "source": "official",
      "auth": "fine-grained token, Plan: read",
      "period": {
        "start": "2026-10-01T00:00:00.000Z",
        "end": "2026-11-01T00:00:00.000Z",
        "anchor": "assumed",
        "anchorNote": "UTC calendar month per docs; not returned by the API"
      },
      "metrics": [
        {
          "key": "actions_minutes",
          "label": "Actions minutes (private repos)",
          "used": 362,
          "limit": 2000,
          "unit": "minutes",
          "resets": true
        },
        {
          "key": "actions_storage",
          "label": "Actions storage",
          "used": 103.326315349,
          "limit": null,
          "unit": "gbh",
          "resets": true,
          "note": "No published cap in GB-hours on Free"
        },
        {
          "key": "packages_storage",
          "label": "Packages storage",
          "used": 0,
          "limit": 500000000,
          "unit": "bytes",
          "resets": false,
          "note": "No SKU row returned: unused"
        }
      ]
    },
    {
      "id": "posthog",
      "name": "PostHog",
      "account": "EU cloud",
      "plan": "Free",
      "source": "official",
      "auth": "personal API key, billing:read",
      "period": {
        "start": "2026-10-11T11:47:22.340Z",
        "end": "2026-11-10T11:47:22.340Z",
        "anchor": "api"
      },
      "metrics": [
        {
          "key": "events",
          "label": "Events",
          "used": 5,
          "limit": 1000000,
          "unit": "count",
          "resets": true
        },
        {
          "key": "mobile_recordings",
          "label": "Mobile recordings",
          "used": 0,
          "limit": 2500,
          "unit": "count",
          "resets": true
        },
        {
          "key": "recordings",
          "label": "Session recordings",
          "used": 1,
          "limit": 5000,
          "unit": "count",
          "resets": true
        },
        {
          "key": "rows_exported",
          "label": "Rows exported",
          "used": 0,
          "limit": 1000000,
          "unit": "count",
          "resets": true
        },
        {
          "key": "cdp_trigger_events",
          "label": "Realtime destination events",
          "used": 0,
          "limit": 10000,
          "unit": "count",
          "resets": true
        },
        {
          "key": "feature_flag_requests",
          "label": "Feature flag requests",
          "used": 0,
          "limit": 1000000,
          "unit": "count",
          "resets": true
        },
        {
          "key": "survey_responses",
          "label": "Survey responses",
          "used": 0,
          "limit": 1500,
          "unit": "count",
          "resets": true
        },
        {
          "key": "historical_rows_synced",
          "label": "Historical rows synced",
          "used": 0,
          "limit": 100000000,
          "unit": "count",
          "resets": true
        },
        {
          "key": "rows_synced",
          "label": "Data warehouse rows",
          "used": 0,
          "limit": 1000000,
          "unit": "count",
          "resets": true
        },
        {
          "key": "exceptions",
          "label": "Error tracking exceptions",
          "used": 0,
          "limit": 100000,
          "unit": "count",
          "resets": true
        },
        {
          "key": "llm_events",
          "label": "LLM analytics events",
          "used": 0,
          "limit": 100000,
          "unit": "count",
          "resets": true
        },
        {
          "key": "logs_mb_ingested",
          "label": "Logs ingested",
          "used": 0,
          "limit": 10000,
          "unit": "mb",
          "resets": true
        },
        {
          "key": "ai_credits",
          "label": "AI credits",
          "used": 6,
          "limit": 500,
          "unit": "count",
          "resets": true
        },
        {
          "key": "replay_vision_credits",
          "label": "Replay vision credits",
          "used": 0,
          "limit": 2500,
          "unit": "count",
          "resets": true
        },
        {
          "key": "signals_credits",
          "label": "Signals credits",
          "used": 0,
          "limit": 4500,
          "unit": "count",
          "resets": true
        },
        {
          "key": "workflow_destinations",
          "label": "Workflow destinations",
          "used": 0,
          "limit": 10000,
          "unit": "count",
          "resets": true
        },
        {
          "key": "workflow_emails",
          "label": "Workflow emails",
          "used": 0,
          "limit": 10000,
          "unit": "count",
          "resets": true
        }
      ]
    },
    {
      "id": "langfuse",
      "name": "Langfuse",
      "account": "EU cloud",
      "plan": "Hobby",
      "source": "official",
      "auth": "project keys, Metrics API",
      "period": {
        "start": "2026-10-01T00:00:00.000Z",
        "end": "2026-11-01T00:00:00.000Z",
        "anchor": "assumed",
        "anchorNote": "Billing anchors to your signup day; set LANGFUSE_BILLING_ANCHOR_DAY in .env"
      },
      "metrics": [
        {
          "key": "units",
          "label": "Units (traces + observations + scores)",
          "used": 8866,
          "limit": 50000,
          "unit": "count",
          "resets": true,
          "confidence": "approximate",
          "note": "traces 647 (root-observation proxy), observations 4995, scores 3224"
        }
      ]
    },
    {
      "id": "supabase",
      "name": "Supabase",
      "account": "org Free, project twoseats (eu-central-1)",
      "plan": "Free",
      "source": "dashboard",
      "auth": "dashboard session (platform API)",
      "period": {
        "start": "2026-10-10T00:00:00.000Z",
        "end": "2026-11-10T00:00:00.000Z",
        "anchor": "api"
      },
      "status": {
        "label": "Project status",
        "value": "ACTIVE_HEALTHY",
        "note": "Free projects pause after 7 days without activity"
      },
      "metrics": [
        {
          "key": "egress",
          "label": "Egress",
          "used": 83141341,
          "limit": 5000000000,
          "unit": "bytes",
          "resets": true
        },
        {
          "key": "cached_egress",
          "label": "Cached egress",
          "used": 0,
          "limit": 5000000000,
          "unit": "bytes",
          "resets": true
        },
        {
          "key": "storage_size",
          "label": "Storage size",
          "used": 0,
          "limit": 1000000000,
          "unit": "bytes",
          "resets": false
        },
        {
          "key": "monthly_active_users",
          "label": "Monthly active users",
          "used": 1,
          "limit": 50000,
          "unit": "count",
          "resets": true
        },
        {
          "key": "monthly_active_third_party_users",
          "label": "Monthly active third-party users",
          "used": 0,
          "limit": 50000,
          "unit": "count",
          "resets": true
        },
        {
          "key": "function_invocations",
          "label": "Edge function invocations",
          "used": 0,
          "limit": 500000,
          "unit": "count",
          "resets": true
        },
        {
          "key": "log_ingestion",
          "label": "Log ingestion",
          "used": 8434631,
          "limit": 1000000000,
          "unit": "bytes",
          "resets": true
        },
        {
          "key": "log_querying",
          "label": "Log querying",
          "used": 1660036400,
          "limit": 100000000000,
          "unit": "bytes",
          "resets": true
        },
        {
          "key": "realtime_message_count",
          "label": "Realtime messages",
          "used": 0,
          "limit": 2000000,
          "unit": "count",
          "resets": true
        },
        {
          "key": "realtime_peak_connections",
          "label": "Realtime peak connections",
          "used": 0,
          "limit": 200,
          "unit": "count",
          "resets": true
        },
        {
          "key": "database_size",
          "label": "Database size",
          "used": 121592629,
          "limit": 500000000,
          "unit": "bytes",
          "resets": false,
          "note": "SQL pg_database_size reports 106.3 MB; the dashboard figure is the quota one"
        }
      ]
    },
    {
      "id": "vercel",
      "name": "Vercel",
      "account": "team your-team, project twoseats",
      "plan": "Hobby",
      "source": "dashboard",
      "auth": "dashboard session (server-rendered usage page); plan via API token",
      "period": {
        "start": "2026-10-01T00:00:00.000Z",
        "end": "2026-11-01T00:00:00.000Z",
        "anchor": "api"
      },
      "metrics": [
        {
          "key": "fast_data_transfer",
          "label": "Fast data transfer",
          "used": 123059037,
          "limit": 100000000000,
          "unit": "bytes",
          "resets": true
        },
        {
          "key": "fast_origin_transfer",
          "label": "Fast origin transfer",
          "used": 89472268,
          "limit": 10000000000,
          "unit": "bytes",
          "resets": true
        },
        {
          "key": "edge_requests",
          "label": "CDN requests",
          "used": 13460,
          "limit": 1000000,
          "unit": "count",
          "resets": true
        },
        {
          "key": "function_invocations",
          "label": "Function invocations",
          "used": 13711,
          "limit": 1000000,
          "unit": "count",
          "resets": true
        },
        {
          "key": "fluid_cpu_duration",
          "label": "Fluid active CPU",
          "used": 792020,
          "limit": 14400000,
          "unit": "ms",
          "resets": true
        },
        {
          "key": "function_duration",
          "label": "Function duration",
          "used": 0,
          "limit": 360,
          "unit": "gbh",
          "resets": true,
          "note": "Raw dashboard unit unverified; shown against the documented 360 GB-hour Hobby limit"
        },
        {
          "key": "edge_request_cpu_duration",
          "label": "CDN request CPU",
          "used": 4580,
          "limit": 3600000,
          "unit": "ms",
          "resets": true
        },
        {
          "key": "image_transformations",
          "label": "Image transformations",
          "used": 0,
          "limit": 5000,
          "unit": "count",
          "resets": true
        },
        {
          "key": "data_cache_reads",
          "label": "ISR reads",
          "used": 0,
          "limit": 300000,
          "unit": "count",
          "resets": true
        },
        {
          "key": "build_cpu",
          "label": "Build CPU time",
          "used": 11760000,
          "limit": null,
          "unit": "ms",
          "resets": true,
          "note": "No Hobby cap on build time; 100 deployments/day"
        },
        {
          "key": "deployment_lambda_storage_size",
          "label": "Functions storage",
          "used": 290379841,
          "limit": 10000000000,
          "unit": "bytes",
          "resets": false
        },
        {
          "key": "deployment_storage_size",
          "label": "Deployment storage",
          "used": 67760645,
          "limit": 10000000000,
          "unit": "bytes",
          "resets": false
        }
      ]
    }
  ]
};
