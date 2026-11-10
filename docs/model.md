# The machine learning model (from Assignment 2)

[Back to README](../README.md)

The guardrail's decision comes from a logistic regression model trained in Assignment 2. The code is in `ml/`. How to retrain it and deploy the new model is in [running.md, section 7](running.md#7-retrain-the-model-and-update-the-website).

## Data sources

The raw data is downloaded by the code from Hugging Face, so it is not included here:

- `xTRam1/safe-guard-prompt-injection` (the base dataset for this topic)
- `S-Labs/prompt-injection-dataset`
- `neuralchemy/Prompt-injection-dataset`
- `deepset/prompt-injections`

The processed dataset and the exact train/test split are saved in `data/` (`dataset_clean.csv`, `train.csv`, `test.csv`).

## Data processing

Everything below happens automatically inside the code; this section explains what it does.

**Preparing the dataset** (`ml/prompt_injection_guardrail_hf.py`):

1. **Extract:** each source is loaded (a Hugging Face dataset id or a `.csv`). The text, label and (if present) category columns are found automatically, and every dataset is converted to the same format: `text`, `label` (1 = attack, 0 = safe), `source`, `category`.
2. **Deduplicate:** prompts are compared after cleaning; duplicates, and texts labelled *safe* in one place but *attack* in another, are removed **before** splitting, so no test prompt also appears in training.
3. **Attack categories:** categories given by a dataset are mapped onto our taxonomy (`CATEGORY_ALIASES`); missing ones are filled by a rule-based tagger.
4. **Split:** stratified 80/20 train/test split with a fixed seed (`random_state=42`).

**Processing each prompt** (inside the saved model pipeline, so it also runs at prediction time):

1. **Cleaning** (`clean_text`) undoes common disguises: rot13, invisible zero-width characters, accented look-alike letters, spaced or dotted letters (`i g n o r e`), base64 and leetspeak (`1gn0re`). It also replaces email addresses and IP addresses with placeholders, and lowercases the text.
2. **Features:** TF-IDF (single words and word pairs) on the cleaned text, plus 14 engineered numeric features: length, character entropy, punctuation, digit and non-ASCII ratios, counts of zero-width characters, spaced letters, leetspeak, base64 and chat-format markers, and counts of instruction-override, role-play and prompt-extraction phrases. The numeric features are standardised and clipped to the range -5 to 5.

**Processing further from the prepared dataset.** `data/dataset_clean.csv` can be fed straight back into the pipeline ([running.md, section 7](running.md#7-retrain-the-model-and-update-the-website)). You can also load it yourself, for example to add new rows or explore it:

```python
# from the repo root; the library is in ml/
import sys; sys.path.insert(0, 'ml')
import pandas as pd
import prompt_injection_guardrail as pig

df = pd.read_csv('data/dataset_clean.csv')
print(df['label'].value_counts())
print(pig.clean_text('1gn0re pr3v10us d1r3ct1v3s'))          # -> 'ignore previous directives'
features = pd.DataFrame([pig.row_features(t) for t in df['text'].head(100)])   # engineered features
pig.run_eda(df, 'outputs_eda')                                # EDA tables and charts (create the folder first)
```

To add your own data, make a CSV with `text` and `label` columns and pass it together with the prepared one, e.g. `--repos data/dataset_clean.csv,my_extra_data.csv`.

## Training

What training does:

1. EDA charts and summary tables.
2. **Feature ablation:** measures whether cleaning and the engineered features improve the results.
3. **Tuning:** `GridSearchCV` for logistic regression, a calibrated linear SVM and a random forest, scored by PR-AUC on the training set only.
4. **Threshold:** chosen on out-of-fold training predictions so that at least 90% of attacks are caught, then precision is as high as possible. It is also checked against the NFR03 targets (accuracy ≥ 90%, F1 ≥ 0.85).
5. **Final evaluation:** on the test set, used once.
6. **Robustness:** scores on disguised test prompts and on innocent prompts that only sound suspicious.
7. **Clustering:** K-means and DBSCAN on attack prompts only.
8. **Category model:** trained for FR03, followed by the explanation demo.
9. **Save:** writes `guardrail_model.joblib`, `category_model.joblib` and `model_meta.json`.

Notes on retraining from `data/dataset_clean.csv`:

- That file has no category column, so all attack categories come from the rule tagger. The neuralchemy categories are only used when training from Hugging Face.
- The class-balance-by-source chart shows a single source.
- Results should be very close to the submitted run, but the split may not be row-for-row identical.

The model takes **raw text**: cleaning and feature building happen inside the saved pipeline, so the website and `ml/predict.py` use exactly the same steps as training.

## Results of the deployed model's training run

Test set (6,401 prompts the models never saw), each model at its own threshold chosen on the training data. These are the figures in `outputs/model_comparison.csv`, from the retrain on `data/dataset_clean.csv` that produced the model in `backend/model/`. The website's **Our data** page reads the same file, so it always matches this table until the model is retrained.

| Model | Threshold | Precision | Recall | ROC-AUC | PR-AUC | Safe prompts blocked (FP) | Attacks missed (FN) |
|---|---|---|---|---|---|---|---|
| **Logistic regression (deployed)** | **0.776** | **0.982** | **0.908** | **0.992** | **0.990** | **45** | **252** |
| Linear SVM (calibrated) | 0.758 | 0.983 | 0.903 | 0.992 | 0.990 | 43 | 265 |
| Random forest | 0.640 | 0.982 | 0.918 | 0.994 | 0.992 | 47 | 225 |

The deployed model's accuracy is 95.4% (3,625 of 3,670 safe prompts allowed and 2,479 of 2,731 attacks blocked). The three models are within about one percentage point of each other on every measure. The Assignment 2 report used an earlier run in which the random forest was saved; its figures differ slightly from these.

## Outputs

| File in `outputs/` | Contents |
|---|---|
| `guardrail_model.joblib`, `category_model.joblib`, `model_meta.json` | Written here by training. The served copies live in `backend/model/` (see [running.md, section 7.3](running.md#73-deploy-the-new-model)) |
| `model_comparison.csv`, `roc_pr_curves.png`, `confusion_matrices.png` | Final test-set comparison |
| `test_scores.csv` | Every model's attack probability for each test prompt; the website draws its curves and threshold explorer from it |
| `tuning_logistic.csv`, `tuning_linear_svm.csv`, `tuning_random_forest.csv` | Every hyperparameter combination tried, with its cross-validation scores |
| `eda_balance_length.png`, `eda_features_vs_label.png`, `eda_correlation.png` | EDA charts |
| `eda_feature_boxes.csv`, `eda_correlation.csv` | The numbers behind the feature box plots and the correlation heatmap; the website draws them from these |
| `kmeans_k_selection.csv`, `kmeans_k_selection.png`, `attack_clusters_2d.png`, `attack_clusters_2d.csv` | Attack clustering (the CSV is a fixed random sample of 3,000 attacks with their 2D position and groups, for the website) |
| `run_complete.json` | Written last, when a training run has finished; the website waits for it before showing a new run |
| `explanation_demo.csv` | `explain()` output for the PMP scenarios |
| `dataset_summary.json` | Dataset size, prompts per source and attack types, for the website's Our data page |

## Model limitations

- The attack-phrase rules and the rot13 check work for English only.
- Attack categories filled in by the rule tagger are weak labels.
- When several rules match, the category follows a fixed priority (extraction, override, role-play, social engineering, embedded). So a role-play jailbreak that also says "ignore your guidelines" is reported as `instruction_override`.
- Attacks that use none of the known phrasings rely on the ML score alone.
