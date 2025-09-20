# 🍗 MODIFIER & SUBSTITUTION FUNCTIONS - INTEGRATION GUIDE

## 📋 **OVERVIEW**

This guide covers the integration of menu modifier and substitution capabilities for the Retell AI voice agent. The system now uses a **single unified function** that handles both modifications (spice levels, add-ons, removals) and substitutions (ingredient swaps).

---

## 🎯 **FUNCTION SPECIFICATION**

### **Function: `addModifierToCart`**

**Purpose:** Adds modifications OR substitutions to cart items (unified function)

**Description:** "Add a modification or substitution to an item in the customer's cart"

**Parameters Schema:**
```json
{
  "type": "object",
  "properties": {
    "modification": {
      "type": "string",
      "description": "The exact modification or substitution to apply",
      "enum": [
        "Original",
        "Mild", 
        "Medium",
        "Hot",
        "Extra Hot", 
        "FCK YOU CRA",
        "Add cheese 1",
        "Add cheese 2", 
        "No cheese 1",
        "No cheese 2",
        "No Pickles 1",
        "No Pickles 2",
        "No Slaw 1", 
        "No Slaw 2",
        "No Big Bird Sauce 1",
        "No Big Bird Sauce 2",
        "Add tender",
        "Pickles on the side",
        "Slaw on the side", 
        "Chicken & Bun Only",
        "Substitute fries with mac & cheese",
        "Substitute fries with slaw",
        "Substitute Slaw with Lettuce 1", 
        "Substitute Slaw with Lettuce 2",
        "Cheese on fries",
        "No Bread",
        "No fries",
        "No White Sauce",
        "No Bird Sauce",
        "Add Slaw"
      ]
    },
    "itemName": {
      "type": "string", 
      "description": "The exact menu item name to modify"
    }
  },
  "required": [
    "itemName",
    "modification"
  ]
}
```

---

## 🔄 **COMPLETE WORKFLOW**

### **Step 1: Add Base Item**
```
Customer: "I want the 2-piece sandwich with fries"
Agent: [calls addToCart with "SANDWICHES W/ FRIES (2pc)"]
```

### **Step 2: Add Modifications/Substitutions**
```
Customer: "Make the first sandwich medium spice and substitute the fries with mac and cheese"
Agent: [calls addModifierToCart with modification: "Medium"] 
Agent: [calls addModifierToCart with modification: "Substitute fries with mac & cheese"]
```

### **Step 3: Get Cart Summary**
```
Agent: [calls getCartSummary to confirm order with all modifications]
```

---

## 🍽️ **MULTI-PIECE ITEM HANDLING**

### **Understanding Piece Numbers**
- **"Add cheese 1"** = cheese on first sandwich
- **"Add cheese 2"** = cheese on second sandwich  
- **"Medium"** + **"Hot"** = first piece medium, second piece hot

### **Example Conversation:**
```
Customer: "I want the 2-piece sandwich combo, make one medium and one hot, and add cheese to the first one"

Agent Actions:
1. addToCart("SANDWICHES W/ FRIES (2pc)")
2. addModifierToCart(modification: "Medium")  
3. addModifierToCart(modification: "Hot")
4. addModifierToCart(modification: "Add cheese 1")
```

---

## 🎤 **AGENT CONVERSATION GUIDELINES**

### **✅ DO:**
- Use **natural language** when speaking to customers
- Map customer requests to **exact enum values** 
- Be **conversational** and helpful
- Confirm modifications clearly

### **❌ DON'T:**
- Say enum values like "Add cheese 1" to customers
- Get confused between modifications and substitutions
- Skip validation of enum values

### **Example Phrases:**
```
Customer: "Add cheese to the first sandwich"
Agent: "Perfect! I'll add cheese to your first sandwich."
[Maps to: "Add cheese 1"]

Customer: "Can I swap the fries for mac and cheese?"  
Agent: "Absolutely! I'll substitute your fries with mac and cheese."
[Maps to: "Substitute fries with mac & cheese"]
```

---

## ⚠️ **ERROR HANDLING**

### **Common Error Cases:**
1. **Item not in cart:** "Please add the item to your cart first"
2. **Invalid modification:** "That modification isn't available for this item"  
3. **Duplicate modification:** "That modification is already applied"

### **Agent Response Examples:**
```
Error: "Modification not available"
Agent: "I'm sorry, that modification isn't available for this item. Let me tell you what options are available..."

Error: "Item not in cart" 
Agent: "Let me add that item to your cart first, then I can make that modification for you."
```

---

## 💬 **CONVERSATION EXAMPLES**

### **Example 1: Simple Spice Selection**
```
Customer: "I want a single sandwich, make it hot"
Agent: "Got it! One hot chicken sandwich coming right up."

Actions:
1. addToCart(itemName: "SINGLE SANDWICH")
2. addModifierToCart(itemName: "SINGLE SANDWICH", modification: "Hot")
```

### **Example 2: Complex Multi-Piece Order**
```
Customer: "2-piece sandwich combo, first one medium with cheese, second one original with no pickles, and swap the fries for mac and cheese"
Agent: "Perfect! Two sandwiches with fries - first one medium with cheese, second one original with no pickles, and I'll swap your fries for mac and cheese."

Actions:
1. addToCart(itemName: "SANDWICHES W/ FRIES (2pc)")  
2. addModifierToCart(itemName: "SANDWICHES W/ FRIES (2pc)", modification: "Medium")
3. addModifierToCart(itemName: "SANDWICHES W/ FRIES (2pc)", modification: "Add cheese 1")
4. addModifierToCart(itemName: "SANDWICHES W/ FRIES (2pc)", modification: "Original") 
5. addModifierToCart(itemName: "SANDWICHES W/ FRIES (2pc)", modification: "No Pickles 2")
6. addModifierToCart(itemName: "SANDWICHES W/ FRIES (2pc)", modification: "Substitute fries with mac & cheese")
```

---

## 🔧 **IMPLEMENTATION NOTES**

### **Critical Requirements:**
- ✅ Function calls must use **exact enum values**
- ✅ `itemName` must match **exact menu item names**  
- ✅ **Order matters:** Add base item first, then modifications
- ✅ Multiple modifications = multiple function calls
- ✅ Price updates happen automatically

### **Technical Details:**
- Backend validates modifications against Square catalog
- Supports piece-specific modifications for multi-piece items
- Automatic price calculation including modifier costs
- Session-based cart management via Retell call ID

---

## 🧪 **TESTING COMMANDS**

### **Test Single Function:**
```bash
curl -X POST https://your-api-gateway/add-modifier-to-cart \
-H "Content-Type: application/json" \
-d '{
  "call": {"call_id": "test_123", "to_number": "+17034567890"},
  "args": {"itemName": "SANDWICHES W/ FRIES (2pc)", "modification": "Medium"}
}'
```

---

## 📞 **RETELL CONFIGURATION**

### **Function Configuration URL:**
- Production: `https://your-api-gateway/add-modifier-to-cart`
- Sandbox: `https://your-api-gateway/sandbox/add-modifier-to-cart`

### **Required Setup:**
1. Add function to Retell agent configuration
2. Use exact JSON schema provided above  
3. Configure proper error handling responses
4. Test with various modification scenarios

---

## 🚨 **IMPORTANT REMINDERS**

- **SINGLE FUNCTION:** Only `addModifierToCart` exists now (handles both mods and subs)
- **ENUM EXACTNESS:** Agent must map natural speech to exact enum values
- **MULTIPLE CALLS:** Complex orders require multiple function calls
- **PIECE SPECIFICITY:** Use numbered modifiers for multi-piece items
- **ORDER DEPENDENCY:** Base item must exist before adding modifications 