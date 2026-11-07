from typing import List, Dict, Any

SAMPLE_CSV_CONTENT = """name,title,company,email,website,notes
Sarah Chen,VP of Engineering,FinScale AI,sarah.chen@finscale.ai,https://finscale.ai,"High growth Series A fintech. Struggling with sales ops data fragmentation. Mentioned in TechCrunch they are scaling enterprise outbound."
Marcus Vance,Head of Growth,CloudOps Pro,marcus@cloudopspro.io,https://cloudopspro.io,"B2B DevOps automation. Expanding from PLG to enterprise sales. Looked at HubSpot and Salesforce but found them too bloated for engineering leaders."
Elena Rostova,Chief Technology Officer,DataPulse Systems,elena@datapulse.tech,https://datapulse.tech,"Real-time analytics platform. Founder-led sales bottleneck. Needs automated sequence generation and CRM hygiene without hiring full-time SDR team."
David Miller,Co-Founder & CEO,Apex Logistics,david@apexlogistics.co,https://apexlogistics.co,"Supply chain visibility platform. 200+ warm leads in spreadsheets with zero follow-up. Expressed urgency around automated handoffs and reply tracking."
Amina Patel,Director of Revenue Operations,HealthStack Inc,amina@healthstack.org,https://healthstack.org,"HIPAA-compliant healthcare workflows. Heavy compliance requirements. Wants auditable AI actions with explicit human approval checkpoints."
"""

SEED_DATA_ACCOUNTS: List[Dict[str, Any]] = [
    {
        "company_name": "FinScale AI",
        "domain": "finscale.ai",
        "industry": "FinTech / AI",
        "summary": "Series A fintech automating risk scoring for modern financial institutions. Scaling enterprise sales team.",
        "source_notes": "High growth Series A fintech. Struggling with sales ops data fragmentation. Mentioned in TechCrunch they are scaling enterprise outbound.",
        "brief": {
            "summary": "FinScale AI is experiencing rapid growth following their Series A round, but their engineering-led leadership is bogged down by manual CRM hygiene and fragmented sales spreadsheets.",
            "facts": [
                {
                    "claim": "FinScale AI is a Series A financial technology company.",
                    "source_type": "user-provided",
                    "confidence": 1.0
                },
                {
                    "claim": "Company domain is finscale.ai and recently covered in TechCrunch.",
                    "source_type": "source-linked",
                    "confidence": 0.95
                },
                {
                    "claim": "Likely experiencing high friction integrating disparate sales tooling with core engineering workflows.",
                    "source_type": "inference",
                    "confidence": 0.85
                }
            ],
            "pain_points": [
                "Sales ops data fragmentation",
                "Lack of automated outbound sequence approvals",
                "High overhead maintaining contact records across spreadsheets"
            ],
            "talking_points": [
                "Showcase zero-overhead CRM record creation directly from lead lists",
                "Highlight audit-first sequence approvals preventing hallucinated outbound",
                "Demonstrate instant warm handoff tasks when prospects respond"
            ]
        },
        "contacts": [
            {
                "name": "Sarah Chen",
                "title": "VP of Engineering",
                "email": "sarah.chen@finscale.ai",
                "linkedin_url": "https://linkedin.com/in/sarahchen-example",
                "source": "csv_import",
                "status": "lead"
            }
        ],
        "deals": [
            {
                "name": "FinScale AI - Enterprise Platform",
                "stage": "Prospecting",
                "value": 36000.0,
                "next_step": "Generate tailored outbound sequence and review with founder",
                "owner": "Founder"
            }
        ],
        "activities": [
            {
                "type": "import",
                "summary": "Imported account, contact (Sarah Chen), and deal from CSV lead list.",
                "source": "csv",
                "metadata_json": {"source_file": "sample_leads.csv"}
            },
            {
                "type": "brief_generated",
                "summary": "Generated structured account brief with 3 verified facts and 3 talking points.",
                "source": "ai",
                "metadata_json": {"model": "relay-intelligence-engine"}
            }
        ]
    },
    {
        "company_name": "CloudOps Pro",
        "domain": "cloudopspro.io",
        "industry": "DevOps / Infrastructure",
        "summary": "B2B DevOps automation platform bridging product-led growth to high-value enterprise contracts.",
        "source_notes": "B2B DevOps automation. Expanding from PLG to enterprise sales. Looked at HubSpot and Salesforce but found them too bloated for engineering leaders.",
        "brief": {
            "summary": "CloudOps Pro has hundreds of developer signups but needs a lightweight CRM that engineering founders will actually use without bloated admin overhead.",
            "facts": [
                {
                    "claim": "Expanding sales model from self-serve PLG to enterprise sales.",
                    "source_type": "user-provided",
                    "confidence": 1.0
                },
                {
                    "claim": "Evaluated legacy CRMs (Salesforce/HubSpot) and rejected due to configuration complexity.",
                    "source_type": "user-provided",
                    "confidence": 1.0
                },
                {
                    "claim": "Needs automated activity logging that does not interrupt developer focus.",
                    "source_type": "inference",
                    "confidence": 0.88
                }
            ],
            "pain_points": [
                "Legacy CRMs are overly complex and abandoned by technical founders",
                "PLG warm leads fall through the cracks without structured follow-ups"
            ],
            "talking_points": [
                "API-first CRM with explicit human approval checkpoints",
                "Transparent state transitions with an immutable audit log"
            ]
        },
        "contacts": [
            {
                "name": "Marcus Vance",
                "title": "Head of Growth",
                "email": "marcus@cloudopspro.io",
                "linkedin_url": "https://linkedin.com/in/marcusvance-example",
                "source": "csv_import",
                "status": "contacted"
            }
        ],
        "deals": [
            {
                "name": "CloudOps Pro - Team License",
                "stage": "Outreach",
                "value": 18000.0,
                "next_step": "Awaiting response to Step 1 email regarding PLG-to-Enterprise pipeline",
                "owner": "Founder"
            }
        ],
        "activities": [
            {
                "type": "import",
                "summary": "Imported account and contact from CSV lead list.",
                "source": "csv",
                "metadata_json": {}
            },
            {
                "type": "sequence_generated",
                "summary": "Generated 3-step outbound sequence tailored to Head of Growth.",
                "source": "ai",
                "metadata_json": {"step_count": 3}
            },
            {
                "type": "sequence_approved",
                "summary": "Outreach sequence approved by Founder. Ready for scheduled delivery.",
                "source": "user",
                "metadata_json": {"approved_steps": 3}
            }
        ],
        "sequences": [
            {
                "status": "approved",
                "rationale": "Focuses on the transition from self-serve developer usage to high-ACV enterprise deals without administrative drag.",
                "steps": [
                    {
                        "step_number": 1,
                        "delay_days": 0,
                        "subject": "PLG to enterprise conversion at CloudOps Pro",
                        "body": "Hi Marcus,\n\nSaw CloudOps Pro is expanding from bottom-up developer adoption into enterprise contracts. Most growth heads we talk to find Salesforce adds friction their dev teams hate.\n\nWe built Relay to keep the CRM updated automatically while keeping full approval control in your hands.\n\nOpen to a 10-minute peek this week?\n\nBest,\nFounding Team",
                        "rationale": "Direct, acknowledges their specific PLG bottleneck, low-friction call to action.",
                        "status": "approved"
                    },
                    {
                        "step_number": 2,
                        "delay_days": 3,
                        "subject": "Re: PLG to enterprise conversion at CloudOps Pro",
                        "body": "Hi Marcus,\n\nQuick follow-up on how engineering-led teams convert active users into 6-figure enterprise accounts without manual CRM bookkeeping.\n\nWould Thursday or Friday afternoon work better for a brief walk-through?\n\nBest,\nFounding Team",
                        "rationale": "Value-oriented reminder with specific day suggestions.",
                        "status": "approved"
                    },
                    {
                        "step_number": 3,
                        "delay_days": 6,
                        "subject": "Closing the loop / CloudOps Pro",
                        "body": "Hi Marcus,\n\nAssuming enterprise sales tooling isn't top priority right now. If things change as CloudOps scales outbound, happy to connect.\n\nBest of luck with the growth push!\n\nBest,\nFounding Team",
                        "rationale": "Respectful breakup email leaving door open.",
                        "status": "approved"
                    }
                ]
            }
        ]
    },
    {
        "company_name": "DataPulse Systems",
        "domain": "datapulse.tech",
        "industry": "Analytics & AI",
        "summary": "Real-time stream analytics engine with fast growing enterprise interest.",
        "source_notes": "Real-time analytics platform. Founder-led sales bottleneck. Needs automated sequence generation and CRM hygiene without hiring full-time SDR team.",
        "brief": {
            "summary": "DataPulse Systems has strong inbound interest from technical teams, but the founding team is overwhelmed balancing coding and sales pipeline hygiene.",
            "facts": [
                {
                    "claim": "Founder-led sales bottleneck is slowing deal velocity.",
                    "source_type": "user-provided",
                    "confidence": 1.0
                },
                {
                    "claim": "Core product is a high-throughput real-time stream analytics platform.",
                    "source_type": "user-provided",
                    "confidence": 1.0
                },
                {
                    "claim": "High likelihood to close if a prompt technical demo is scheduled.",
                    "source_type": "inference",
                    "confidence": 0.9
                }
            ],
            "pain_points": [
                "Founder spends 15+ hours weekly manually updating spreadsheets and drafting emails",
                "Delayed responses to warm prospects cause pipeline leakage"
            ],
            "talking_points": [
                "Automated inbound sentiment parsing and instant handoff queue",
                "Deterministic stage progression with full audit history"
            ]
        },
        "contacts": [
            {
                "name": "Elena Rostova",
                "title": "Chief Technology Officer",
                "email": "elena@datapulse.tech",
                "linkedin_url": "https://linkedin.com/in/elenarostova-example",
                "source": "csv_import",
                "status": "replied"
            }
        ],
        "deals": [
            {
                "name": "DataPulse - Enterprise Architecture Deal",
                "stage": "Demo Scheduled",
                "value": 48000.0,
                "next_step": "Prepare customized technical demo for Elena and lead architect on Thursday 2pm",
                "owner": "Founder"
            }
        ],
        "activities": [
            {
                "type": "import",
                "summary": "Imported account, contact (Elena Rostova), and deal from lead list.",
                "source": "csv",
                "metadata_json": {}
            },
            {
                "type": "sequence_approved",
                "summary": "Outreach sequence approved by Founder.",
                "source": "user",
                "metadata_json": {}
            },
            {
                "type": "inbound_interaction",
                "summary": "Prospect replied enthusiastically: 'Hey, this sounds relevant. We're looking at stream processing pipelines right now. Can we do a 20-min demo Thursday 2pm?'",
                "source": "ai",
                "metadata_json": {
                    "sentiment": "positive",
                    "intent": "request_demo",
                    "previous_stage": "Outreach",
                    "new_stage": "Demo Scheduled"
                }
            },
            {
                "type": "stage_change",
                "summary": "Deal stage moved from Outreach to Demo Scheduled because prospect requested a live demo.",
                "source": "ai",
                "metadata_json": {"previous_stage": "Outreach", "new_stage": "Demo Scheduled"}
            },
            {
                "type": "task_created",
                "summary": "Created high-priority handoff task: Schedule technical demo with Elena Rostova.",
                "source": "ai",
                "metadata_json": {"priority": "high"}
            }
        ],
        "handoffs": [
            {
                "title": "Schedule technical demo with Elena Rostova (CTO)",
                "reason": "Elena replied asking for a 20-min live demo on Thursday at 2pm regarding real-time stream processing architecture.",
                "status": "pending"
            }
        ]
    }
]
