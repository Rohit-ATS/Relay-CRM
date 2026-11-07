import json
import logging
from typing import Optional, Dict, Any, List
import httpx

from app.core.config import settings
from app.schemas.ai import (
    AccountBrief,
    FactItem,
    SequenceGenerated,
    SequenceStepGenerated,
    InteractionAnalysisResponse,
    ProposedUpdate
)

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self):
        self.anthropic_key = settings.ANTHROPIC_API_KEY
        self.openai_key = settings.OPENAI_API_KEY
        self.model = settings.DEFAULT_AI_MODEL

    # -------------------------------------------------------------
    # 1. ACCOUNT BRIEF GENERATION
    # -------------------------------------------------------------
    async def generate_account_brief(
        self,
        company_name: str,
        domain: Optional[str] = None,
        industry: Optional[str] = None,
        source_notes: Optional[str] = None,
        custom_instructions: Optional[str] = None
    ) -> AccountBrief:
        """
        Generates structured account brief where every fact is strictly labeled
        as 'user-provided', 'source-linked', or 'inference'. Never invents verified facts.
        """
        prompt = f"""
You are an AI research assistant inside Relay CRM.
Task: Analyze the account and generate a structured brief.
Rules:
1. Every claim in 'facts' must be labeled with source_type: 'user-provided', 'source-linked', or 'inference'.
2. DO NOT invent verified facts. If inferring something, explicitly mark it as 'inference'.
3. Return valid JSON matching this schema:
{{
  "summary": "2-3 sentences summarizing the account and why they are a target",
  "facts": [
    {{"claim": "...", "source_type": "user-provided|source-linked|inference", "confidence": 0.0-1.0}}
  ],
  "pain_points": ["point 1", "point 2"],
  "talking_points": ["point 1", "point 2"]
}}

Account Details:
Company Name: {company_name}
Domain: {domain or 'N/A'}
Industry: {industry or 'N/A'}
Source Notes: {source_notes or 'N/A'}
Additional Instructions: {custom_instructions or 'N/A'}
"""
        # Try live model if key exists
        if self.anthropic_key:
            try:
                res = await self._call_anthropic(prompt)
                data = self._extract_json(res)
                return AccountBrief(**data)
            except Exception as e:
                logger.warning(f"Anthropic call failed for brief: {e}. Falling back to deterministic fixture.")

        if self.openai_key:
            try:
                res = await self._call_openai(prompt)
                data = self._extract_json(res)
                return AccountBrief(**data)
            except Exception as e:
                logger.warning(f"OpenAI call failed for brief: {e}. Falling back to deterministic fixture.")

        # High-quality deterministic fixture tailored to input
        return self._fallback_brief(company_name, domain, industry, source_notes)

    # -------------------------------------------------------------
    # 2. SEQUENCE GENERATION
    # -------------------------------------------------------------
    async def generate_sequence(
        self,
        company_name: str,
        contact_name: str,
        contact_title: Optional[str] = None,
        domain: Optional[str] = None,
        source_notes: Optional[str] = None,
        brief: Optional[Dict[str, Any]] = None,
        custom_angle: Optional[str] = None
    ) -> SequenceGenerated:
        """
        Generates a 3-step email-first outreach plan with timing (delay_days),
        rationale, and editable drafts.
        """
        prompt = f"""
You are an expert B2B copywriter for founder-led outbound inside Relay CRM.
Task: Generate a personalized 3-step email outreach sequence for {contact_name} ({contact_title or 'Executive'}) at {company_name}.
Requirements:
1. Step 1: Day 0 - Direct, relevant problem statement based on provided notes, low-pressure question.
2. Step 2: Day 3 - Specific value proposition or relevant example.
3. Step 3: Day 6 - Respectful, low friction closing/breakup message.
4. Each step must have step_number (1, 2, 3), delay_days (0, 3, 6), subject, body, and rationale.
5. Return strictly valid JSON:
{{
  "rationale": "Overall strategy rationale for this account",
  "steps": [
    {{
      "step_number": 1,
      "delay_days": 0,
      "subject": "...",
      "body": "...",
      "rationale": "..."
    }}
  ]
}}

Details:
Company: {company_name}
Contact: {contact_name} ({contact_title})
Domain: {domain}
Notes: {source_notes}
Angle: {custom_angle or 'Founder-led B2B efficiency'}
"""
        if self.anthropic_key:
            try:
                res = await self._call_anthropic(prompt)
                data = self._extract_json(res)
                return SequenceGenerated(**data)
            except Exception as e:
                logger.warning(f"Anthropic sequence call failed: {e}. Falling back to deterministic fixture.")

        if self.openai_key:
            try:
                res = await self._call_openai(prompt)
                data = self._extract_json(res)
                return SequenceGenerated(**data)
            except Exception as e:
                logger.warning(f"OpenAI sequence call failed: {e}. Falling back to deterministic fixture.")

        return self._fallback_sequence(company_name, contact_name, contact_title, source_notes)

    # -------------------------------------------------------------
    # 3. INTERACTION ANALYSIS (Simulated prospect reply / call note)
    # -------------------------------------------------------------
    async def analyze_interaction(
        self,
        company_name: str,
        current_stage: str,
        contact_name: Optional[str],
        channel: str,
        content: str
    ) -> InteractionAnalysisResponse:
        """
        Parses prospect response or meeting transcript, detects sentiment & intent,
        proposes new deal stage, provides reasoning and evidence quote, and suggests
        a warm handoff task.
        """
        prompt = f"""
You are an AI deal intelligence agent in Relay CRM.
Analyze the following prospect interaction for {company_name}.
Current deal stage: {current_stage}
Channel: {channel}
Contact: {contact_name or 'Prospect'}

Interaction content:
\"\"\"{content}\"\"\"

Determine:
1. Sentiment: positive, neutral, negative, questioning, or interested
2. Intent: request_demo, objection, unsubscribe, question, or warm_followup
3. Proposed deal stage update (e.g., if asking for demo/meeting -> 'Demo Scheduled' or 'Engaged'; if not interested -> 'Closed Lost'; if interested but has questions -> 'Engaged')
4. Evidence quote from text
5. Clear reasoning why the stage should change
6. Recommended human handoff task (title and reason)

Return valid JSON:
{{
  "sentiment": "...",
  "intent": "...",
  "proposed_update": {{
    "current_stage": "{current_stage}",
    "proposed_stage": "...",
    "confidence": 0.95,
    "reasoning": "...",
    "evidence_quote": "...",
    "recommended_task_title": "...",
    "recommended_task_reason": "..."
  }}
}}
"""
        if self.anthropic_key:
            try:
                res = await self._call_anthropic(prompt)
                data = self._extract_json(res)
                return InteractionAnalysisResponse(
                    sentiment=data["sentiment"],
                    intent=data["intent"],
                    proposed_update=ProposedUpdate(**data["proposed_update"]),
                    applied=False
                )
            except Exception as e:
                logger.warning(f"Anthropic interaction call failed: {e}. Using deterministic fixture.")

        if self.openai_key:
            try:
                res = await self._call_openai(prompt)
                data = self._extract_json(res)
                return InteractionAnalysisResponse(
                    sentiment=data["sentiment"],
                    intent=data["intent"],
                    proposed_update=ProposedUpdate(**data["proposed_update"]),
                    applied=False
                )
            except Exception as e:
                logger.warning(f"OpenAI interaction call failed: {e}. Using deterministic fixture.")

        return self._fallback_interaction(company_name, current_stage, contact_name, content)

    # -------------------------------------------------------------
    # DETERMINISTIC FALLBACKS (Guaranteed to work without API keys)
    # -------------------------------------------------------------
    def _fallback_brief(
        self,
        company_name: str,
        domain: Optional[str],
        industry: Optional[str],
        source_notes: Optional[str]
    ) -> AccountBrief:
        notes = source_notes or ""
        facts: List[FactItem] = [
            FactItem(
                claim=f"{company_name} is operating in the {industry or 'B2B technology'} sector.",
                source_type="user-provided" if industry else "inference",
                confidence=1.0 if industry else 0.8
            )
        ]
        if domain:
            facts.append(FactItem(
                claim=f"Primary web domain is identified as {domain}.",
                source_type="source-linked",
                confidence=1.0
            ))
        if notes:
            facts.append(FactItem(
                claim=f"Context notes provided: {notes[:120]}...",
                source_type="user-provided",
                confidence=1.0
            ))
            facts.append(FactItem(
                claim="Founder-led outbound automation is likely a critical bottleneck for this company.",
                source_type="inference",
                confidence=0.85
            ))

        return AccountBrief(
            summary=f"{company_name} is a high-potential prospect with indicated operational scaling needs. Automated outbound and CRM upkeep will unlock immediate pipeline capacity.",
            facts=facts,
            pain_points=[
                "Manual CRM updating creates gaps between prospecting and execution",
                "Founder time spent tracking email follow-ups rather than closing deals",
                "Inconsistent record hygiene across team members"
            ],
            talking_points=[
                "Demonstrate automated audit trail for all outbound actions",
                "Highlight human-in-the-loop sequence approvals before any message is queued",
                "Show instant warm lead handoff tasks triggered by prospect responses"
            ]
        )

    def _fallback_sequence(
        self,
        company_name: str,
        contact_name: str,
        contact_title: Optional[str],
        source_notes: Optional[str]
    ) -> SequenceGenerated:
        first_name = contact_name.split()[0] if contact_name else "there"
        title = contact_title or "team lead"
        
        step1_body = (
            f"Hi {first_name},\n\n"
            f"Noticed your work scaling {company_name}. Many {title}s we speak with find that "
            f"sales tools add excessive manual upkeep that slows down engineering and growth momentum.\n\n"
            f"We built Relay so founders and growth teams get a self-updating CRM that prepares personalized "
            f"outbound without losing control over approvals.\n\n"
            f"Would you be open to a 10-minute walkthrough this week?\n\n"
            f"Best,\nFounding Team"
        )

        step2_body = (
            f"Hi {first_name},\n\n"
            f"Following up on my previous note. One thing our users at high-growth companies appreciate is that "
            f"Relay automatically logs every timeline interaction and flags warm prospect replies into an instant handoff queue.\n\n"
            f"Would Thursday or Friday afternoon suit you for a brief chat?\n\n"
            f"Best,\nFounding Team"
        )

        step3_body = (
            f"Hi {first_name},\n\n"
            f"I realize you're focused on higher priorities at {company_name} right now. "
            f"If streamline outbound and automated CRM record keeping becomes top of mind later this quarter, "
            f"I'd welcome the chance to connect.\n\n"
            f"Wishing you and the {company_name} team continued success!\n\n"
            f"Best,\nFounding Team"
        )

        return SequenceGenerated(
            rationale=f"Founder-focused 3-touch sequence for {contact_name} at {company_name}. Emphasizes zero-friction CRM maintenance and executive approval controls.",
            steps=[
                SequenceStepGenerated(
                    step_number=1,
                    delay_days=0,
                    subject=f"Outbound execution and CRM upkeep at {company_name}",
                    body=step1_body,
                    rationale="Problem-first outreach highlighting administrative fatigue and approval control."
                ),
                SequenceStepGenerated(
                    step_number=2,
                    delay_days=3,
                    subject=f"Re: Outbound execution and CRM upkeep at {company_name}",
                    body=step2_body,
                    rationale="Follow-up demonstrating product differentiation (audit timeline + warm handoff queue)."
                ),
                SequenceStepGenerated(
                    step_number=3,
                    delay_days=6,
                    subject=f"Closing the loop / {company_name}",
                    body=step3_body,
                    rationale="Low-pressure closing email maintaining cordial relationship for future timing."
                )
            ]
        )

    def _fallback_interaction(
        self,
        company_name: str,
        current_stage: str,
        contact_name: Optional[str],
        content: str
    ) -> InteractionAnalysisResponse:
        lower = content.lower()
        first_name = contact_name.split()[0] if contact_name else "Prospect"

        if any(term in lower for term in ["demo", "chat", "call", "meet", "thursday", "friday", "interested", "sounds good", "calendar"]):
            sentiment = "positive"
            intent = "request_demo"
            proposed_stage = "Demo Scheduled" if ("demo" in lower or "thursday" in lower or "call" in lower) else "Engaged"
            task_title = f"Schedule demo / follow up with {contact_name or 'lead'} ({company_name})"
            task_reason = f"Prospect expressed direct interest and requested a meeting or demo: '{content[:80]}...'"
            reasoning = f"Prospect responded positively requesting a meeting or demo. Advancing stage from {current_stage} to {proposed_stage}."
        elif any(term in lower for term in ["unsubscribe", "not interested", "remove", "stop", "no thanks"]):
            sentiment = "negative"
            intent = "unsubscribe"
            proposed_stage = "Closed Lost"
            task_title = f"Remove {contact_name or company_name} from active outbound"
            task_reason = "Prospect explicitly opted out of further outreach."
            reasoning = f"Prospect opted out. Updating stage from {current_stage} to Closed Lost."
        else:
            sentiment = "questioning"
            intent = "question"
            proposed_stage = "Engaged"
            task_title = f"Reply to questions from {contact_name or company_name}"
            task_reason = f"Prospect raised questions or shared additional context: '{content[:80]}...'"
            reasoning = f"Prospect initiated conversation. Advancing from {current_stage} to Engaged to answer questions."

        evidence = content[:150]

        return InteractionAnalysisResponse(
            sentiment=sentiment,
            intent=intent,
            proposed_update=ProposedUpdate(
                current_stage=current_stage,
                proposed_stage=proposed_stage,
                confidence=0.94,
                reasoning=reasoning,
                evidence_quote=evidence,
                recommended_task_title=task_title,
                recommended_task_reason=task_reason
            ),
            applied=False
        )

    # -------------------------------------------------------------
    # HELPER METHODS FOR API CALLS
    # -------------------------------------------------------------
    async def _call_anthropic(self, prompt: str) -> str:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.anthropic_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": self.model if "claude" in self.model else "claude-3-5-sonnet-20241022",
                    "max_tokens": 1500,
                    "messages": [{"role": "user", "content": prompt}]
                }
            )
            resp.raise_for_status()
            data = resp.json()
            return data["content"][0]["text"]

    async def _call_openai(self, prompt: str) -> str:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.openai_key}",
                    "content-type": "application/json"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"}
                }
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    def _extract_json(self, text: str) -> Dict[str, Any]:
        text = text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text)


ai_service = AIService()
