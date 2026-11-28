"""The MCP prompt: a ready-made instruction a client can insert."""


def weekly_collection_report(area: str) -> str:
    """Ready-made instruction: a weekly collection report for one area."""
    return (
        f'"{area}" এলাকার এই সপ্তাহের আদায়ের রিপোর্ট তৈরি করো।\n\n'
        "ধাপগুলো:\n"
        "1. প্রথমে somiti://areas/list resource থেকে এলাকাগুলোর তালিকা দেখে "
        f'"{area}" এলাকার id বের করো।\n'
        "2. তারপর list_due_installments tool-টা ওই area_id দিয়ে ডাকো — "
        "ওই এলাকার বকেয়া কিস্তিগুলো পাবে।\n"
        "3. get_collection_summary tool-টা period last_7_days দিয়ে ডাকো — "
        "সারা সমিতির এই সপ্তাহের মোট আদায় পাবে।\n"
        "4. দরকার হলে get_member_balance দিয়ে কোনো সদস্যের মোট হিসাব "
        "যাচাই করো।\n\n"
        "রিপোর্টে যা যা থাকবে:\n"
        "- ওই এলাকায় মোট কতটি কিস্তি বকেয়া আছে, মোট কত টাকা বাকি\n"
        "- কে কে বাকি রেখেছে, তাদের নামের তালিকা\n"
        "- সারা সমিতির এই সপ্তাহের মোট আদায়\n"
        "উত্তর বাংলায়, ছোট করে দেবে। কোনো হিসাব বানিয়ে বলবে না — "
        "শুধু tool থেকে পাওয়া তথ্যই ব্যবহার করবে।"
    )
