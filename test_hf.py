from huggingface_hub import InferenceClient

client = InferenceClient(
    model="nlpconnect/vit-gpt2-image-captioning",
    token="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"
)

with open("Screenshot 2026-05-01-232110.png", "rb") as f:
    result = client.image_to_text(f.read())

print(result)