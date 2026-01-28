# LTIP Phase 2: Analysis & ML Pipeline Implementation Plan

**Date**: 2026-01-28
**Phase**: 2 of 3
**Duration**: 8 weeks (37 working days)
**Methodology**: ODIN (Outline Driven INtelligence)
**Prerequisites**: Phase 1 MVP Complete

---

## Executive Summary

Phase 2 introduces the machine learning pipeline that differentiates LTIP from existing legislative tracking tools. This phase delivers neutral bill summarization, multi-perspective bias detection, passage probability prediction, fiscal impact estimation, and conflict-of-interest detection.

### Phase 2 Objectives
- Establish ML infrastructure (FastAPI, MLflow, GPU compute)
- Deploy BART-based bill summarization (150-word neutral summaries)
- Implement BERT ensemble for bias detection (-1 to +1 scoring)
- Train XGBoost passage prediction model (25+ features)
- Build impact estimation from CBO/GAO data
- Create COI detection from financial disclosures
- Deliver Analysis UI with multi-perspective views

---

## Work Packages

### WP8: ML Infrastructure
**Duration**: 4 days
**Dependencies**: Phase 1 WP2 (Database), WP3 (Ingestion)
**Risk Level**: MEDIUM

#### Tasks

| ID | Task | Effort | Acceptance Criteria | Testable Deliverable |
|----|------|--------|---------------------|---------------------|
| T8.1 | Set up FastAPI ML service | 0.5d | Health endpoint returns 200 | Pytest passes |
| T8.2 | Configure MLflow for experiment tracking | 0.5d | Experiments log to MLflow UI | Model logged successfully |
| T8.3 | Set up GPU compute (AWS/GCP) | 1d | CUDA available, PyTorch GPU works | nvidia-smi shows GPU |
| T8.4 | Create model serving infrastructure | 1d | Models load and serve predictions | Inference benchmark <500ms |
| T8.5 | Implement model versioning pipeline | 0.5d | Models versioned in registry | Version rollback works |
| T8.6 | Set up monitoring (Prometheus/Grafana) | 0.5d | Metrics dashboard accessible | Alert fires on threshold |

#### Risks
| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| **R4: GPU Infrastructure Cost** | HIGH | MEDIUM | 16 | Spot instances, auto-scaling, CPU fallback |
| MLflow version compatibility | LOW | MEDIUM | 6 | Pin versions, Docker containers |

---

### WP9: Bill Summarization (BART)
**Duration**: 5 days
**Dependencies**: WP8
**Risk Level**: MEDIUM

#### Tasks

| ID | Task | Effort | Acceptance Criteria | Testable Deliverable |
|----|------|--------|---------------------|---------------------|
| T9.1 | Fine-tune BART on legislative corpus | 2d | ROUGE-L score >0.35 | Evaluation metrics logged |
| T9.2 | Implement neutrality enforcement | 1d | No partisan language in output | Bias check passes |
| T9.3 | Create 150-word summary constraint | 0.5d | Summaries 140-160 words | Length validation test |
| T9.4 | Build summary caching layer | 0.5d | Cache hit rate >80% | Cache metrics dashboard |
| T9.5 | Implement batch summarization | 0.5d | Process 100 bills/hour | Throughput benchmark |
| T9.6 | Add summary quality scoring | 0.5d | Quality score 0-100 per summary | Score distribution analysis |

#### Risks
| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| BART hallucination | MEDIUM | HIGH | 12 | Fact verification layer, human review sampling |
| Training data bias | MEDIUM | MEDIUM | 9 | Balanced corpus, bias auditing |

---

### WP10: Bias Detection (BERT Ensemble)
**Duration**: 6 days
**Dependencies**: WP8
**Risk Level**: HIGH

#### Tasks

| ID | Task | Effort | Acceptance Criteria | Testable Deliverable |
|----|------|--------|---------------------|---------------------|
| T10.1 | Train BERT classifier (left/center/right) | 2d | F1 score >0.75 per class | Evaluation report |
| T10.2 | Implement lexical keyword analyzer | 0.5d | Detects 500+ partisan terms | Term detection test |
| T10.3 | Build semantic similarity component | 1d | Compares to political frameworks | Similarity scores valid |
| T10.4 | Create entity political lean matcher | 1d | Maps entities to political positions | Entity mapping test |
| T10.5 | Implement ensemble voting | 0.5d | Weighted average of 4 methods | Ensemble output valid |
| T10.6 | Calculate confidence from variance | 0.5d | Confidence = 1/variance | Confidence calibration test |
| T10.7 | Build bias explanation generator | 0.5d | Explains why score given | Explanation coherence test |

#### Risks
| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| **R3: ML Model Accuracy** | MEDIUM | HIGH | 15 | Ensemble approach, human validation, continuous retraining |
| Political bias in training data | HIGH | HIGH | 20 | Balanced dataset, third-party audit |

---

### WP11: Passage Prediction (XGBoost)
**Duration**: 5 days
**Dependencies**: WP8, Phase 1 WP7 (Historical Data)
**Risk Level**: MEDIUM

#### Tasks

| ID | Task | Effort | Acceptance Criteria | Testable Deliverable |
|----|------|--------|---------------------|---------------------|
| T11.1 | Engineer 25+ prediction features | 1.5d | Features documented and extracted | Feature extraction test |
| T11.2 | Train XGBoost on historical outcomes | 1.5d | AUC-ROC >0.78 | Model evaluation report |
| T11.3 | Implement feature importance tracking | 0.5d | SHAP values computed | Feature importance viz |
| T11.4 | Build prediction explanation generator | 0.5d | Top 5 factors per prediction | Explanation test |
| T11.5 | Create prediction confidence intervals | 0.5d | 95% CI per prediction | Calibration curve |
| T11.6 | Implement prediction caching | 0.5d | Predictions cached 24h | Cache hit test |

#### Feature Categories (25+)
1. **Sponsor features**: Party, seniority, committee membership, past success rate
2. **Bill features**: Word count, complexity score, subjects, similar bill outcomes
3. **Timing features**: Days to session end, election proximity
4. **Support features**: Cosponsors count, bipartisan ratio
5. **Committee features**: Committee referral, chair party alignment

#### Risks
| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| Feature engineering complexity | MEDIUM | MEDIUM | 9 | Iterative feature addition, ablation studies |
| Historical data quality | MEDIUM | MEDIUM | 9 | Data validation, outlier handling |

---

### WP12: Impact Estimation
**Duration**: 4 days
**Dependencies**: WP8, WP11
**Risk Level**: MEDIUM

#### Tasks

| ID | Task | Effort | Acceptance Criteria | Testable Deliverable |
|----|------|--------|---------------------|---------------------|
| T12.1 | Integrate CBO cost estimate API | 1d | CBO data ingested for bills | Integration test |
| T12.2 | Build GAO outcomes data pipeline | 1d | GAO reports linked to bills | Link validation test |
| T12.3 | Create fiscal impact predictor | 1d | Predicts budget impact range | Prediction accuracy test |
| T12.4 | Implement population impact estimator | 0.5d | Estimates affected population | Estimate validation |
| T12.5 | Build impact confidence scoring | 0.5d | Confidence based on data availability | Confidence test |

#### Risks
| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| CBO data availability | MEDIUM | MEDIUM | 9 | Fallback estimation models |
| Impact prediction uncertainty | MEDIUM | MEDIUM | 9 | Wide confidence intervals, disclaimers |

---

### WP13: Conflict of Interest Detection
**Duration**: 5 days
**Dependencies**: WP8, Phase 1 WP4 (API)
**Risk Level**: MEDIUM

#### Tasks

| ID | Task | Effort | Acceptance Criteria | Testable Deliverable |
|----|------|--------|---------------------|---------------------|
| T13.1 | Parse House/Senate financial disclosures | 1.5d | Stock holdings extracted | Parser accuracy test |
| T13.2 | Integrate FEC campaign contribution data | 1d | Donations linked to legislators | Integration test |
| T13.3 | Build sector-bill mapping | 0.5d | Bills tagged with affected sectors | Mapping validation |
| T13.4 | Implement COI detection rules | 1d | Priority: Stock > Family > Lobbying > Donations | Rule execution test |
| T13.5 | Create COI severity scoring | 0.5d | Severity HIGH/MEDIUM/LOW | Scoring consistency test |
| T13.6 | Build COI explanation generator | 0.5d | Explains conflict clearly | Explanation test |

#### COI Priority Order
1. Stock holdings in affected companies (CRITICAL)
2. Family employment at affected entities (HIGH)
3. Lobbying contacts from affected industries (MEDIUM)
4. Campaign donations from affected sectors (LOW)

#### Risks
| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| Disclosure format changes | MEDIUM | MEDIUM | 9 | Flexible parsers, format detection |
| False positive COI flags | MEDIUM | HIGH | 12 | Conservative thresholds, human review |

---

### WP14: Analysis UI
**Duration**: 8 days
**Dependencies**: WP9, WP10, WP11, WP12, WP13, Phase 1 WP6 (Frontend)
**Risk Level**: LOW

#### Tasks

| ID | Task | Effort | Acceptance Criteria | Testable Deliverable |
|----|------|--------|---------------------|---------------------|
| T14.1 | Build Analysis tab component structure | 0.5d | Tab navigation works | Navigation test |
| T14.2 | Create Summary display component | 1d | Summary renders with quality score | Render test |
| T14.3 | Build Bias Meter visualization | 1.5d | -1 to +1 scale with confidence | Visual regression test |
| T14.4 | Create Multi-perspective tabs (L/C/R) | 1.5d | Three perspectives display | Content accuracy test |
| T14.5 | Build Passage Prediction gauge | 1d | 0-100% with confidence interval | Gauge renders correctly |
| T14.6 | Create Impact visualization (fiscal/population) | 1d | Charts render impact data | Chart accuracy test |
| T14.7 | Build COI alert component | 0.5d | Flags display with severity | Alert test |
| T14.8 | Implement Historical Matches sidebar | 1d | Similar bills listed with outcomes | Match accuracy test |

#### Risks
| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| UI performance with ML data | LOW | MEDIUM | 6 | Lazy loading, virtualization |

---

## Dependency Graph

```
[Phase 1 Complete] ──> [WP8: ML Infrastructure] ──┬──> [WP9: Summarization] ───┐
                                                  │                            │
                                                  ├──> [WP10: Bias Detection] ─┼──> [WP14: Analysis UI]
                                                  │                            │
                                                  ├──> [WP11: Prediction] ─────┤
                                                  │                            │
                                                  ├──> [WP12: Impact] ─────────┤
                                                  │                            │
                                                  └──> [WP13: COI Detection] ──┘
```

---

## Risk Matrix Summary

| ID | Risk | Probability | Impact | Score | Priority |
|----|------|-------------|--------|-------|----------|
| R3 | ML Model Accuracy | MEDIUM | HIGH | 15 | HIGH |
| R4 | GPU Infrastructure Cost | HIGH | MEDIUM | 16 | HIGH |
| R5 | Political bias in training data | HIGH | HIGH | 20 | CRITICAL |
| R6 | BART hallucination | MEDIUM | HIGH | 12 | MEDIUM |
| R7 | False positive COI flags | MEDIUM | HIGH | 12 | MEDIUM |

---

## Phase 2 Exit Criteria

- [ ] All 41 tasks completed and tested
- [ ] Summarization ROUGE-L score >0.35
- [ ] Bias detection F1 score >0.75
- [ ] Passage prediction AUC-ROC >0.78
- [ ] COI detection precision >0.85
- [ ] ML inference latency <500ms (p95)
- [ ] Analysis UI loads <2s
- [ ] No partisan bias in summarization (audited)
- [ ] Model versioning and rollback working

---

## Effort Summary

| Work Package | Days | Tasks |
|--------------|------|-------|
| WP8: ML Infrastructure | 4 | 6 |
| WP9: Summarization | 5 | 6 |
| WP10: Bias Detection | 6 | 7 |
| WP11: Passage Prediction | 5 | 6 |
| WP12: Impact Estimation | 4 | 5 |
| WP13: COI Detection | 5 | 6 |
| WP14: Analysis UI | 8 | 8 |
| **Total** | **37** | **44** |

---

## Appendix: Model Architecture Decisions

### Why BART over T5 for Summarization?
- Better performance on abstractive summarization
- Efficient fine-tuning for domain-specific text
- Strong performance on legal/legislative language

### Why BERT Ensemble over Single Model?
- Ensemble reduces single-point-of-failure bias
- Multiple perspectives (lexical, semantic, entity)
- Confidence derived from inter-model agreement
- More robust to adversarial inputs

### Why XGBoost over Neural Networks for Prediction?
- Interpretable feature importance
- Works well with tabular features
- Faster training and inference
- Lower infrastructure requirements

### Bias Detection Ensemble Components
1. **Lexical Analysis**: Keyword matching against partisan term database
2. **BERT Classification**: Fine-tuned on labeled political text
3. **Semantic Similarity**: Compare to left/right framework embeddings
4. **Entity Lean Matching**: Map mentioned entities to political positions

### COI Detection Priority Rationale
- Stock holdings: Direct financial interest (highest severity)
- Family employment: Indirect but significant conflict
- Lobbying contacts: Influence relationship
- Campaign donations: Weakest but documented conflict
