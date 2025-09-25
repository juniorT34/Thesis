# prepare_csv.py
import pandas as pd
from sklearn.model_selection import train_test_split

# Paths
openphish_path = "feed.txt"          # your OpenPhish feed
tranco_path = "benign.csv"   # Tranco domains (second column is domain)
train_csv = "train.csv"
val_csv = "val.csv"

# Load OpenPhish (positives)
with open(openphish_path, "r", encoding="utf-8", errors="ignore") as f:
    phishing_urls = [line.strip() for line in f if line.strip()]

df_pos = pd.DataFrame({'text': phishing_urls, 'label':1})

# Load Tranco domains (negatives)
tranco_df = pd.read_csv(tranco_path, header=None)
domains = tranco_df[0].astype(str).tolist()
# Convert to URLs
benign_urls = [f"http://{d}/" for d in domains]
# Remove any overlap with phishing URLs
benign_urls = list(set(benign_urls) - set(phishing_urls))
df_neg = pd.DataFrame({'text': benign_urls, 'label':0})

# Combine
df = pd.concat([df_pos, df_neg], ignore_index=True)
df = df.sample(frac=1.0, random_state=42)  # shuffle

# Split 80/20 train/val
train_df, val_df = train_test_split(df, test_size=0.2, stratify=df['label'], random_state=42)

# Save CSV
train_df.to_csv(train_csv, index=False)
val_df.to_csv(val_csv, index=False)
print(f"Saved train.csv ({len(train_df)}) and val.csv ({len(val_df)})")
