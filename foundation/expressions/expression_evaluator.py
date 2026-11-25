# foundation/expressions/expression_evaluator.py
import ast
import operator
from datetime import datetime, timedelta
from typing import Dict, Any, List

class ExpressionEvaluator:
    """Centralized, safe AST evaluator for Formulas, Workflows, and Validation Rules."""

    ALLOWED_OPERATORS = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Eq: operator.eq,
        ast.NotEq: operator.ne,
        ast.Gt: operator.gt,
        ast.Lt: operator.lt,
        ast.GtE: operator.ge,
        ast.LtE: operator.le,
        ast.And: lambda a, b: a and b,
        ast.Or: lambda a, b: a or b,
        ast.Not: operator.not_
    }

    # --- FUNCTION REGISTRY ---
    BUILTIN_FUNCTIONS = {
        "UPPER": lambda args: str(args[0]).upper() if args and args[0] is not None else "",
        "LOWER": lambda args: str(args[0]).lower() if args and args[0] is not None else "",
        "CONTAINS": lambda args: str(args[1]) in str(args[0]) if len(args) == 2 and args[0] is not None and args[1] is not None else False,
        "BEGINS_WITH": lambda args: str(args[0]).startswith(str(args[1])) if len(args) == 2 and args[0] is not None and args[1] is not None else False,
        "IF": lambda args: args[1] if args[0] else args[2] if len(args) == 3 else None,
        
        # Semantic Date Functions
        "NOW": lambda args: datetime.now().isoformat(),
        "TODAY": lambda args: datetime.now().date().isoformat(),
        "IS_NULL": lambda args: (not args) or args[0] is None or str(args[0]).strip() == ""
    }

    @classmethod
    def evaluate(cls, expr_str: str, context: Dict[str, Any]) -> Any:
        try:
            tree = ast.parse(expr_str, mode='eval')
            return cls._eval_node(tree.body, context)
        except Exception as e:
            raise ValueError(f"Expression evaluation error on '{expr_str}': {e}")

    @classmethod
    def extract_dependencies(cls, expr_str: str) -> List[str]:
        """Scans a formula and returns all dot-notation field paths (outermost only)."""
        class DependencyExtractor(ast.NodeVisitor):
            def __init__(self):
                self.paths = set()

            def visit_Call(self, node: ast.Call):
                for arg in node.args:
                    self.visit(arg)

            def visit_Attribute(self, node: ast.Attribute):
                path = cls._build_path(node)
                if path:
                    self.paths.add(path)

            def visit_Name(self, node: ast.Name):
                self.paths.add(node.id)

        try:
            tree = ast.parse(expr_str, mode='eval')
            extractor = DependencyExtractor()
            extractor.visit(tree)
            filtered_paths = [p for p in extractor.paths if p not in cls.BUILTIN_FUNCTIONS]
            return filtered_paths
        except SyntaxError:
            return []

    @classmethod
    def _build_path(cls, node: ast.AST) -> str:
        """Helper to reconstruct 'Account.Owner.Name' from the AST."""
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            base = cls._build_path(node.value)
            if base:
                return f"{base}.{node.attr}"
        return ""

    @classmethod
    def _safe_parse_date(cls, val: Any) -> Any:
        """Attempts to parse an ISO-8601 string into a datetime object."""
        if isinstance(val, str):
            try:
                return datetime.fromisoformat(val.replace("Z", "+00:00"))
            except ValueError:
                pass
        return val

    @classmethod
    def _eval_node(cls, node: ast.AST, context: Dict[str, Any]) -> Any:
        if isinstance(node, ast.Constant):
            return node.value

        elif isinstance(node, ast.Name):
            resolver = context.get("__resolver__") 
            if resolver:
                return resolver(node.id, context)
            return context.get(node.id)

        elif isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
            return not cls._eval_node(node.operand, context)

        # elif isinstance(node, ast.BinOp):
        #     left = cls._eval_node(node.left, context)
        #     right = cls._eval_node(node.right, context)

        #     # --- NULL HANDLING ---
        #     if isinstance(node.op, ast.Add) and (isinstance(left, str) or isinstance(right, str)):
        #         if left is None: left = ""
        #         if right is None: right = ""
        #         return str(left) + str(right)

        #     if left is None: left = 0
        #     if right is None: right = 0

        #     # SEMANTIC DATE MATH (Date + Days)
        #     if isinstance(node.op, (ast.Add, ast.Sub)):
        #         parsed_left = cls._safe_parse_date(left)
        #         if isinstance(parsed_left, datetime) and isinstance(right, (int, float)):
        #             delta = timedelta(days=right)
        #             result_date = parsed_left + delta if isinstance(node.op, ast.Add) else parsed_left - delta
        #             return result_date.isoformat()

        #     if isinstance(left, str):
        #         try: left = float(left)
        #         except ValueError: pass

        #     if isinstance(right, str):
        #         try: right = float(right)
        #         except ValueError: pass

        #     return cls.ALLOWED_OPERATORS[type(node.op)](left, right)

        elif isinstance(node, ast.BinOp):
            left = cls._eval_node(node.left, context)
            right = cls._eval_node(node.right, context)

            # --- 1. SEMANTIC DATE MATH (Date + Days) ---
            # Must evaluate BEFORE string concatenation
            if isinstance(node.op, (ast.Add, ast.Sub)):
                parsed_left = cls._safe_parse_date(left)
                if isinstance(parsed_left, datetime) and isinstance(right, (int, float)):
                    delta = timedelta(days=right)
                    result_date = parsed_left + delta if isinstance(node.op, ast.Add) else parsed_left - delta
                    
                    # Preserve DATE format if the original was a DATE string (YYYY-MM-DD)
                    if isinstance(left, str) and len(left) == 10:
                        return result_date.date().isoformat()
                    return result_date.isoformat()

            # --- 2. NULL HANDLING & STRING CONCATENATION ---
            if isinstance(node.op, ast.Add) and (isinstance(left, str) or isinstance(right, str)):
                if left is None: left = ""
                if right is None: right = ""
                return str(left) + str(right)

            if left is None: left = 0
            if right is None: right = 0

            # --- 3. STANDARD MATH ---
            if isinstance(left, str):
                try: left = float(left)
                except ValueError: pass

            if isinstance(right, str):
                try: right = float(right)
                except ValueError: pass

            return cls.ALLOWED_OPERATORS[type(node.op)](left, right)

        elif isinstance(node, ast.BoolOp):
            values = [cls._eval_node(v, context) for v in node.values]
            return all(values) if isinstance(node.op, ast.And) else any(values)

        elif isinstance(node, ast.Compare):
            left = cls._eval_node(node.left, context)
            for op, comparator in zip(node.ops, node.comparators):
                right = cls._eval_node(comparator, context)

                if left is None or right is None:
                    if isinstance(op, (ast.Eq, ast.NotEq)):
                        pass
                    else:
                        return False

                if isinstance(left, str) and isinstance(right, (int, float)):
                    try: left = float(left)
                    except ValueError: pass
                elif isinstance(right, str) and isinstance(left, (int, float)):
                    try: right = float(right)
                    except ValueError: pass

                if not cls.ALLOWED_OPERATORS[type(op)](left, right):
                    return False
                left = right
            return True

        # --- ARCHITECTURAL FIX FOR AST ATTRIBUTES ---
        elif isinstance(node, ast.Attribute):
            path = cls._build_path(node)
            resolver = context.get("__resolver__")
            if resolver:
                return resolver(path, context)
            
            base_obj = cls._eval_node(node.value, context)
            if isinstance(base_obj, dict):
                return base_obj.get(node.attr)
            return None

        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name):
                func_name = node.func.id.upper()
                args = [cls._eval_node(arg, context) for arg in node.args]

                if func_name in cls.BUILTIN_FUNCTIONS:
                    return cls.BUILTIN_FUNCTIONS[func_name](args)
                else:
                    raise ValueError(f"Unsupported formula function: '{func_name}'")
            return None

        return None