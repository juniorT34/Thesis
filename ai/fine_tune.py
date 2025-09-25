# fine_tune.py
from datasets import load_dataset
from transformers import AutoTokenizer, AutoModelForSequenceClassification, TrainingArguments, Trainer
import torch

MODEL = "ealvaradob/bert-finetuned-phishing"
tokenizer = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForSequenceClassification.from_pretrained(MODEL, num_labels=2)

# Load CSV dataset
dataset = load_dataset("csv", data_files={"train":"train.csv","validation":"val.csv"})

def preprocess(batch):
    return tokenizer(batch["text"], truncation=True, padding="max_length", max_length=128)

encoded_dataset = dataset.map(preprocess, batched=True)
encoded_dataset = encoded_dataset.rename_column("label","labels")
encoded_dataset.set_format(type="torch", columns=["input_ids","attention_mask","labels"])

training_args = TrainingArguments(
    output_dir="./hf_finetuned",
    per_device_train_batch_size=16,
    per_device_eval_batch_size=32,
    num_train_epochs=3,
    evaluation_strategy="epoch",
    save_strategy="epoch",
    learning_rate=2e-5,
    weight_decay=0.01,
    logging_steps=200,
    fp16=torch.cuda.is_available(),
    save_total_limit=2
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=encoded_dataset["train"],
    eval_dataset=encoded_dataset["validation"]
)

trainer.train()
trainer.save_model("./hf_finetuned")
tokenizer.save_pretrained("./hf_finetuned")
print("Fine-tuning completed, model saved in ./hf_finetuned")
