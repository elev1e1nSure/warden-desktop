# Язык программирования "Кот" — дерево-обходной интерпретатор
# Лексер, Парсер, Интерпретатор — всё в одном файле

import re
import sys
from enum import Enum

# ─── Лексер ───────────────────────────────────────────────────────────────────


class TokenType(Enum):
    # Литералы
    NUMBER = "NUMBER"
    STRING = "STRING"
    IDENTIFIER = "IDENTIFIER"
    # Ключевые слова
    VAR = "VAR"
    IF = "IF"
    ELSE = "ELSE"
    WHILE = "WHILE"
    FUNC = "FUNC"
    RETURN = "RETURN"
    PRINT = "PRINT"
    TRUE = "TRUE"
    FALSE = "FALSE"
    AND = "AND"
    OR = "OR"
    NOT = "NOT"
    NIL = "NIL"
    # Операторы
    PLUS = "PLUS"
    MINUS = "MINUS"
    STAR = "STAR"
    SLASH = "SLASH"
    EQ = "EQ"  # ==
    NEQ = "NEQ"  # !=
    LT = "LT"  # <
    GT = "GT"  # >
    LTE = "LTE"  # <=
    GTE = "GTE"  # >=
    ASSIGN = "ASSIGN"  # =
    LPAREN = "LPAREN"
    RPAREN = "RPAREN"
    LBRACE = "LBRACE"
    RBRACE = "RBRACE"
    COMMA = "COMMA"
    SEMICOLON = "SEMICOLON"
    EOF = "EOF"


KEYWORDS = {
    "var": TokenType.VAR,
    "if": TokenType.IF,
    "else": TokenType.ELSE,
    "while": TokenType.WHILE,
    "func": TokenType.FUNC,
    "return": TokenType.RETURN,
    "print": TokenType.PRINT,
    "true": TokenType.TRUE,
    "false": TokenType.FALSE,
    "and": TokenType.AND,
    "or": TokenType.OR,
    "not": TokenType.NOT,
    "nil": TokenType.NIL,
}


class Token:
    def __init__(self, type_: TokenType, lexeme: str, literal, line: int):
        self.type = type_
        self.lexeme = lexeme
        self.literal = literal
        self.line = line

    def __repr__(self):
        return f"Token({self.type}, {self.lexeme!r}, {self.literal!r})"


class LexerError(Exception):
    pass


class Lexer:
    def __init__(self, source: str):
        self.source = source
        self.tokens = []
        self.start = 0
        self.current = 0
        self.line = 1

    def error(self, msg):
        raise LexerError(f"[line {self.line}] {msg}")

    def is_at_end(self):
        return self.current >= len(self.source)

    def advance(self):
        c = self.source[self.current]
        self.current += 1
        return c

    def peek(self):
        if self.is_at_end():
            return "\0"
        return self.source[self.current]

    def peek_next(self):
        if self.current + 1 >= len(self.source):
            return "\0"
        return self.source[self.current + 1]

    def match(self, expected):
        if self.is_at_end():
            return False
        if self.source[self.current] != expected:
            return False
        self.current += 1
        return True

    def skip_whitespace(self):
        while True:
            c = self.peek()
            if c in " \t\r":
                self.advance()
            elif c == "\n":
                self.line += 1
                self.advance()
            elif c == "/" and self.peek_next() == "/":
                # Комментарий до конца строки
                while self.peek() != "\n" and not self.is_at_end():
                    self.advance()
            else:
                break

    def string(self):
        while self.peek() != '"' and not self.is_at_end():
            if self.peek() == "\n":
                self.line += 1
            self.advance()
        if self.is_at_end():
            self.error("Незакрытая строка")
        self.advance()  # closing "
        value = self.source[self.start + 1 : self.current - 1]
        self.add_token(TokenType.STRING, value)

    def number(self):
        while self.peek().isdigit():
            self.advance()
        if self.peek() == "." and self.peek_next().isdigit():
            self.advance()
            while self.peek().isdigit():
                self.advance()
        value = float(self.source[self.start : self.current])
        if value == int(value):
            value = int(value)
        self.add_token(TokenType.NUMBER, value)

    def identifier(self):
        while self.peek().isalnum() or self.peek() == "_":
            self.advance()
        text = self.source[self.start : self.current]
        ttype = KEYWORDS.get(text, TokenType.IDENTIFIER)
        if ttype in (TokenType.TRUE, TokenType.FALSE):
            literal = text == "true"
        elif ttype == TokenType.NIL:
            literal = None
        else:
            literal = None
        self.add_token(ttype, literal)

    def add_token(self, type_: TokenType, literal=None):
        lexeme = self.source[self.start : self.current]
        self.tokens.append(Token(type_, lexeme, literal, self.line))

    def tokenize(self):
        while not self.is_at_end():
            self.skip_whitespace()
            self.start = self.current
            if self.is_at_end():
                break
            c = self.advance()
            if c == '"':
                self.string()
            elif c.isdigit():
                self.number()
            elif c.isalpha() or c == "_":
                self.identifier()
            elif c == "+":
                self.add_token(TokenType.PLUS)
            elif c == "-":
                self.add_token(TokenType.MINUS)
            elif c == "*":
                self.add_token(TokenType.STAR)
            elif c == "/":
                self.add_token(TokenType.SLASH)
            elif c == "(":
                self.add_token(TokenType.LPAREN)
            elif c == ")":
                self.add_token(TokenType.RPAREN)
            elif c == "{":
                self.add_token(TokenType.LBRACE)
            elif c == "}":
                self.add_token(TokenType.RBRACE)
            elif c == ",":
                self.add_token(TokenType.COMMA)
            elif c == ";":
                self.add_token(TokenType.SEMICOLON)
            elif c == "=":
                if self.match("="):
                    self.add_token(TokenType.EQ)
                else:
                    self.add_token(TokenType.ASSIGN)
            elif c == "!":
                if self.match("="):
                    self.add_token(TokenType.NEQ)
                else:
                    self.error("Неожиданный символ '!'")
            elif c == "<":
                if self.match("="):
                    self.add_token(TokenType.LTE)
                else:
                    self.add_token(TokenType.LT)
            elif c == ">":
                if self.match("="):
                    self.add_token(TokenType.GTE)
                else:
                    self.add_token(TokenType.GT)
            else:
                self.error(f"Неожиданный символ '{c}'")
        self.tokens.append(Token(TokenType.EOF, "", None, self.line))
        return self.tokens


# ─── AST (синтаксическое дерево) ──────────────────────────────────────────────


class Expr:
    pass


class Literal(Expr):
    def __init__(self, value):
        self.value = value

    def __repr__(self):
        return f"Literal({self.value!r})"


class Variable(Expr):
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"Variable({self.name!r})"


class Assign(Expr):
    def __init__(self, name, value):
        self.name = name
        self.value = value

    def __repr__(self):
        return f"Assign({self.name!r}, {self.value!r})"


class Binary(Expr):
    def __init__(self, left, op, right):
        self.left = left
        self.op = op
        self.right = right

    def __repr__(self):
        return f"Binary({self.left}, {self.op.lexeme!r}, {self.right!r})"


class Unary(Expr):
    def __init__(self, op, right):
        self.op = op
        self.right = right

    def __repr__(self):
        return f"Unary({self.op.lexeme!r}, {self.right!r})"


class Logical(Expr):
    def __init__(self, left, op, right):
        self.left = left
        self.op = op
        self.right = right

    def __repr__(self):
        return f"Logical({self.left}, {self.op.lexeme!r}, {self.right!r})"


class Call(Expr):
    def __init__(self, callee, arguments):
        self.callee = callee
        self.arguments = arguments

    def __repr__(self):
        return f"Call({self.callee!r}, {self.arguments!r})"


class Grouping(Expr):
    def __init__(self, expression):
        self.expression = expression

    def __repr__(self):
        return f"Group({self.expression!r})"


class Stmt:
    pass


class ExprStmt(Stmt):
    def __init__(self, expression):
        self.expression = expression

    def __repr__(self):
        return f"ExprStmt({self.expression!r})"


class PrintStmt(Stmt):
    def __init__(self, expression):
        self.expression = expression

    def __repr__(self):
        return f"Print({self.expression!r})"


class VarStmt(Stmt):
    def __init__(self, name, initializer):
        self.name = name
        self.initializer = initializer

    def __repr__(self):
        return f"Var({self.name!r}, {self.initializer!r})"


class Block(Stmt):
    def __init__(self, statements):
        self.statements = statements

    def __repr__(self):
        return f"Block({self.statements!r})"


class IfStmt(Stmt):
    def __init__(self, condition, then_branch, else_branch):
        self.condition = condition
        self.then_branch = then_branch
        self.else_branch = else_branch

    def __repr__(self):
        return f"If({self.condition!r}, {self.then_branch!r}, {self.else_branch!r})"


class WhileStmt(Stmt):
    def __init__(self, condition, body):
        self.condition = condition
        self.body = body

    def __repr__(self):
        return f"While({self.condition!r}, {self.body!r})"


class FuncStmt(Stmt):
    def __init__(self, name, params, body):
        self.name = name
        self.params = params
        self.body = body

    def __repr__(self):
        return f"Func({self.name!r}, {self.params!r}, ...)"


class ReturnStmt(Stmt):
    def __init__(self, value):
        self.value = value

    def __repr__(self):
        return f"Return({self.value!r})"


# ─── Парсер (рекурсивный спуск) ──────────────────────────────────────────────


class ParseError(Exception):
    pass


class Parser:
    def __init__(self, tokens: list):
        self.tokens = tokens
        self.current = 0

    def error(self, token, msg):
        if token.type == TokenType.EOF:
            raise ParseError(f"[line {token.line}] {msg} в конце")
        raise ParseError(f"[line {token.line}] {msg} у '{token.lexeme}'")

    def peek(self):
        return self.tokens[self.current]

    def previous(self):
        return self.tokens[self.current - 1]

    def is_at_end(self):
        return self.peek().type == TokenType.EOF

    def check(self, *types):
        return self.peek().type in types

    def advance(self):
        if not self.is_at_end():
            self.current += 1
        return self.previous()

    def match(self, *types):
        if self.check(*types):
            self.advance()
            return True
        return False

    def consume(self, type_: TokenType, msg: str):
        if self.check(type_):
            return self.advance()
        raise self.error(self.peek(), msg)

    # --- Синтаксис ---

    def parse(self):
        statements = []
        while not self.is_at_end():
            statements.append(self.declaration())
        return statements

    def declaration(self):
        try:
            if self.match(TokenType.VAR):
                return self.var_declaration()
            if self.match(TokenType.FUNC):
                return self.func_declaration()
            return self.statement()
        except ParseError:
            self.synchronize()
            return None

    def var_declaration(self):
        name = self.consume(TokenType.IDENTIFIER, "Ожидается имя переменной").lexeme
        initializer = None
        if self.match(TokenType.ASSIGN):
            initializer = self.expression()
        self.consume(TokenType.SEMICOLON, "Ожидается ';' после объявления переменной")
        return VarStmt(name, initializer)

    def func_declaration(self):
        name = self.consume(TokenType.IDENTIFIER, "Ожидается имя функции").lexeme
        self.consume(TokenType.LPAREN, "Ожидается '(' после имени функции")
        params = []
        if not self.check(TokenType.RPAREN):
            while True:
                if len(params) >= 255:
                    self.error(self.peek(), "Слишком много параметров (макс. 255)")
                params.append(self.consume(TokenType.IDENTIFIER, "Ожидается имя параметра").lexeme)
                if not self.match(TokenType.COMMA):
                    break
        self.consume(TokenType.RPAREN, "Ожидается ')' после параметров")
        self.consume(TokenType.LBRACE, "Ожидается '{' перед телом функции")
        body = self.block()
        return FuncStmt(name, params, body)

    def statement(self):
        if self.match(TokenType.PRINT):
            return self.print_statement()
        if self.match(TokenType.IF):
            return self.if_statement()
        if self.match(TokenType.WHILE):
            return self.while_statement()
        if self.match(TokenType.RETURN):
            return self.return_statement()
        if self.match(TokenType.LBRACE):
            return Block(self.block())
        return self.expression_statement()

    def print_statement(self):
        expr = self.expression()
        self.consume(TokenType.SEMICOLON, "Ожидается ';' после выражения")
        return PrintStmt(expr)

    def return_statement(self):
        value = None
        if not self.check(TokenType.SEMICOLON):
            value = self.expression()
        self.consume(TokenType.SEMICOLON, "Ожидается ';' после return")
        return ReturnStmt(value)

    def if_statement(self):
        self.consume(TokenType.LPAREN, "Ожидается '(' после if")
        condition = self.expression()
        self.consume(TokenType.RPAREN, "Ожидается ')' после условия")
        then_branch = self.statement()
        else_branch = None
        if self.match(TokenType.ELSE):
            else_branch = self.statement()
        return IfStmt(condition, then_branch, else_branch)

    def while_statement(self):
        self.consume(TokenType.LPAREN, "Ожидается '(' после while")
        condition = self.expression()
        self.consume(TokenType.RPAREN, "Ожидается ')' после условия")
        body = self.statement()
        return WhileStmt(condition, body)

    def block(self):
        statements = []
        while not self.check(TokenType.RBRACE) and not self.is_at_end():
            statements.append(self.declaration())
        self.consume(TokenType.RBRACE, "Ожидается '}' после блока")
        return statements

    def expression_statement(self):
        expr = self.expression()
        self.consume(TokenType.SEMICOLON, "Ожидается ';' после выражения")
        return ExprStmt(expr)

    def expression(self):
        return self.assignment()

    def assignment(self):
        expr = self._or()
        if self.match(TokenType.ASSIGN):
            equals = self.previous()
            value = self.assignment()
            if isinstance(expr, Variable):
                return Assign(expr.name, value)
            self.error(equals, "Некорректная цель присваивания")
        return expr

    def _or(self):
        expr = self._and()
        while self.match(TokenType.OR):
            op = self.previous()
            right = self._and()
            expr = Logical(expr, op, right)
        return expr

    def _and(self):
        expr = self.equality()
        while self.match(TokenType.AND):
            op = self.previous()
            right = self.equality()
            expr = Logical(expr, op, right)
        return expr

    def equality(self):
        expr = self.comparison()
        while self.match(TokenType.EQ, TokenType.NEQ):
            op = self.previous()
            right = self.comparison()
            expr = Binary(expr, op, right)
        return expr

    def comparison(self):
        expr = self.term()
        while self.match(TokenType.LT, TokenType.GT, TokenType.LTE, TokenType.GTE):
            op = self.previous()
            right = self.term()
            expr = Binary(expr, op, right)
        return expr

    def term(self):
        expr = self.factor()
        while self.match(TokenType.PLUS, TokenType.MINUS):
            op = self.previous()
            right = self.factor()
            expr = Binary(expr, op, right)
        return expr

    def factor(self):
        expr = self.unary()
        while self.match(TokenType.STAR, TokenType.SLASH):
            op = self.previous()
            right = self.unary()
            expr = Binary(expr, op, right)
        return expr

    def unary(self):
        if self.match(TokenType.MINUS, TokenType.NOT):
            op = self.previous()
            right = self.unary()
            return Unary(op, right)
        return self.call()

    def call(self):
        expr = self.primary()
        while True:
            if self.match(TokenType.LPAREN):
                args = []
                if not self.check(TokenType.RPAREN):
                    while True:
                        if len(args) >= 255:
                            self.error(self.peek(), "Слишком много аргументов (макс. 255)")
                        args.append(self.expression())
                        if not self.match(TokenType.COMMA):
                            break
                self.consume(TokenType.RPAREN, "Ожидается ')' после аргументов")
                expr = Call(expr, args)
            else:
                break
        return expr

    def primary(self):
        if self.match(TokenType.NUMBER):
            return Literal(self.previous().literal)
        if self.match(TokenType.STRING):
            return Literal(self.previous().literal)
        if self.match(TokenType.TRUE):
            return Literal(True)
        if self.match(TokenType.FALSE):
            return Literal(False)
        if self.match(TokenType.NIL):
            return Literal(None)
        if self.match(TokenType.LPAREN):
            expr = self.expression()
            self.consume(TokenType.RPAREN, "Ожидается ')' после выражения")
            return Grouping(expr)
        if self.match(TokenType.IDENTIFIER):
            return Variable(self.previous().lexeme)
        raise self.error(self.peek(), "Ожидается выражение")

    def synchronize(self):
        self.advance()
        while not self.is_at_end():
            if self.previous().type == TokenType.SEMICOLON:
                return
            if self.peek().type in (
                TokenType.VAR,
                TokenType.FUNC,
                TokenType.IF,
                TokenType.WHILE,
                TokenType.PRINT,
                TokenType.RETURN,
            ):
                return
            self.advance()


# ─── Среда / Окружение ────────────────────────────────────────────────────────


class Environment:
    def __init__(self, enclosing=None):
        self.values = {}
        self.enclosing = enclosing

    def define(self, name, value):
        self.values[name] = value

    def get(self, name):
        if name in self.values:
            return self.values[name]
        if self.enclosing:
            return self.enclosing.get(name)
        raise RuntimeError(f"Неопределённая переменная '{name}'")

    def assign(self, name, value):
        if name in self.values:
            self.values[name] = value
            return
        if self.enclosing:
            self.enclosing.assign(name, value)
            return
        raise RuntimeError(f"Неопределённая переменная '{name}'")


# ─── Вызываемые значения (функции) ────────────────────────────────────────────


class KotFunction:
    def __init__(self, declaration, closure):
        self.declaration = declaration
        self.closure = closure

    def call(self, interpreter, arguments):
        env = Environment(self.closure)
        for i, param in enumerate(self.declaration.params):
            env.define(param, arguments[i])
        try:
            interpreter.execute_block(self.declaration.body, env)
        except ReturnValue as ret:
            return ret.value
        return None

    def arity(self):
        return len(self.declaration.params)

    def __repr__(self):
        return f"<функция {self.declaration.name}>"


class ReturnValue(Exception):
    def __init__(self, value):
        self.value = value


class BuiltinFunction:
    def __init__(self, name, arity, func):
        self._name = name
        self._arity = arity
        self._func = func

    def call(self, interpreter, arguments):
        return self._func(arguments)

    def arity(self):
        return self._arity

    def __repr__(self):
        return f"<встроенная {self._name}>"


# ─── Интерпретатор ────────────────────────────────────────────────────────────


def kot_type_name(value):
    if value is None:
        return "nil"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, (int, float)):
        return "число"
    if isinstance(value, str):
        return "строка"
    return "объект"


class Interpreter:
    def __init__(self):
        self.globals = Environment()
        self.env = self.globals

        # Встроенные функции
        self.globals.define(
            "clock", BuiltinFunction("clock", 0, lambda args: __import__("time").time())
        )
        self.globals.define("str", BuiltinFunction("str", 1, lambda args: str(args[0])))
        self.globals.define("число", BuiltinFunction("число", 1, lambda args: float(args[0])))
        self.globals.define("len", BuiltinFunction("len", 1, lambda args: len(str(args[0]))))
        self.globals.define("input", BuiltinFunction("input", 1, lambda args: input(str(args[0]))))
        self.globals.define("type", BuiltinFunction("type", 1, lambda args: kot_type_name(args[0])))

    def interpret(self, statements):
        try:
            for stmt in statements:
                self.execute(stmt)
        except RuntimeError as e:
            print(f"Ошибка: {e}")
        except ParseError as e:
            print(f"Ошибка парсинга: {e}")
        except LexerError as e:
            print(f"Ошибка лексического анализа: {e}")

    def execute(self, stmt):
        if isinstance(stmt, ExprStmt):
            self.evaluate(stmt.expression)
        elif isinstance(stmt, PrintStmt):
            value = self.evaluate(stmt.expression)
            print(self.stringify(value))
        elif isinstance(stmt, VarStmt):
            value = None
            if stmt.initializer:
                value = self.evaluate(stmt.initializer)
            self.env.define(stmt.name, value)
        elif isinstance(stmt, Block):
            self.execute_block(stmt.statements, Environment(self.env))
        elif isinstance(stmt, IfStmt):
            cond = self.is_truthy(self.evaluate(stmt.condition))
            if cond:
                self.execute(stmt.then_branch)
            elif stmt.else_branch:
                self.execute(stmt.else_branch)
        elif isinstance(stmt, WhileStmt):
            while self.is_truthy(self.evaluate(stmt.condition)):
                self.execute(stmt.body)
        elif isinstance(stmt, FuncStmt):
            func = KotFunction(stmt, self.env)
            self.env.define(stmt.name, func)
        elif isinstance(stmt, ReturnStmt):
            value = None
            if stmt.value:
                value = self.evaluate(stmt.value)
            raise ReturnValue(value)

    def execute_block(self, statements, env):
        prev = self.env
        try:
            self.env = env
            for stmt in statements:
                self.execute(stmt)
        finally:
            self.env = prev

    def evaluate(self, expr):
        if isinstance(expr, Literal):
            return expr.value
        elif isinstance(expr, Grouping):
            return self.evaluate(expr.expression)
        elif isinstance(expr, Variable):
            return self.env.get(expr.name)
        elif isinstance(expr, Assign):
            value = self.evaluate(expr.value)
            self.env.assign(expr.name, value)
            return value
        elif isinstance(expr, Logical):
            left = self.evaluate(expr.left)
            if expr.op.type == TokenType.OR:
                if self.is_truthy(left):
                    return left
            else:  # AND
                if not self.is_truthy(left):
                    return left
            return self.evaluate(expr.right)
        elif isinstance(expr, Binary):
            left = self.evaluate(expr.left)
            right = self.evaluate(expr.right)
            op = expr.op.type
            if op == TokenType.PLUS:
                if isinstance(left, (int, float)) and isinstance(right, (int, float)):
                    return left + right
                if isinstance(left, str) and isinstance(right, str):
                    return left + right
                if isinstance(left, str):
                    return left + str(right)
                if isinstance(right, str):
                    return str(left) + right
                raise RuntimeError("'+' не поддерживается между этими типами")
            elif op == TokenType.MINUS:
                self.check_number_operands(op, left, right)
                return left - right
            elif op == TokenType.STAR:
                if isinstance(left, (int, float)) and isinstance(right, (int, float)):
                    return left * right
                if isinstance(left, str) and isinstance(right, int):
                    return left * right
                if isinstance(left, int) and isinstance(right, str):
                    return left * right
                raise RuntimeError("'*' не поддерживается между этими типами")
            elif op == TokenType.SLASH:
                self.check_number_operands(op, left, right)
                if right == 0:
                    raise RuntimeError("Деление на ноль")
                return left / right
            elif op == TokenType.EQ:
                return left == right
            elif op == TokenType.NEQ:
                return left != right
            elif op == TokenType.LT:
                self.check_number_operands(op, left, right)
                return left < right
            elif op == TokenType.GT:
                self.check_number_operands(op, left, right)
                return left > right
            elif op == TokenType.LTE:
                self.check_number_operands(op, left, right)
                return left <= right
            elif op == TokenType.GTE:
                self.check_number_operands(op, left, right)
                return left >= right
        elif isinstance(expr, Unary):
            right = self.evaluate(expr.right)
            op = expr.op.type
            if op == TokenType.MINUS:
                self.check_number_operand(op, right)
                return -right
            elif op == TokenType.NOT:
                return not self.is_truthy(right)
        elif isinstance(expr, Call):
            callee = self.evaluate(expr.callee)
            if not hasattr(callee, "call"):
                raise RuntimeError("Можно вызвать только функцию")
            if hasattr(callee, "arity") and len(expr.arguments) != callee.arity():
                raise RuntimeError(
                    f"Нужно {callee.arity()} аргументов, получено {len(expr.arguments)}"
                )
            args = [self.evaluate(a) for a in expr.arguments]
            return callee.call(self, args)
        raise RuntimeError(f"Неизвестное выражение: {type(expr)}")

    def check_number_operand(self, op, operand):
        if isinstance(operand, (int, float)):
            return
        raise RuntimeError(f"Оператор '{op}' требует числовое значение")

    def check_number_operands(self, op, left, right):
        if isinstance(left, (int, float)) and isinstance(right, (int, float)):
            return
        raise RuntimeError(f"Оператор '{op}' требует числовые значения")

    def is_truthy(self, value):
        if value is None:
            return False
        if isinstance(value, bool):
            return value
        return True

    def stringify(self, value):
        if value is None:
            return "nil"
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, float):
            if value == int(value):
                return str(int(value))
            return str(value)
        return str(value)


# ─── REPL и запуск файлов ────────────────────────────────────────────────────


def run(source, interpreter=None):
    if interpreter is None:
        interpreter = Interpreter()
    try:
        lexer = Lexer(source)
        tokens = lexer.tokenize()
        parser = Parser(tokens)
        statements = parser.parse()
        if statements:
            interpreter.interpret(statements)
    except (LexerError, ParseError, RuntimeError) as e:
        print(f"Ошибка: {e}")
    return interpreter


def run_file(path):
    with open(path, encoding="utf-8") as f:
        source = f.read()
    interpreter = Interpreter()
    run(source, interpreter)


def repl():
    print("🐱 Язык программирования Кот v1.0")
    print("Введите 'exit' или Ctrl+C для выхода")
    print()
    interpreter = Interpreter()
    while True:
        try:
            line = input("кот> ")
            if line.strip() == "exit":
                break
            if line.strip() == "":
                continue
            run(line, interpreter)
        except KeyboardInterrupt:
            print("\nДо свидания!")
            break
        except EOFError:
            print()
            break


if __name__ == "__main__":
    if len(sys.argv) > 1:
        run_file(sys.argv[1])
    else:
        repl()
