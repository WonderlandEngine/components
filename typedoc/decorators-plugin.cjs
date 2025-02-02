const td = require('typedoc');
const ts = td.TypeScript;

exports.load = function (app) {
    // Add decorator info to reflections
    // if you need parameters, you need app.converter.on(td.Converter.EVENT_CREATE_PARAMETER)
    app.converter.on(td.Converter.EVENT_CREATE_DECLARATION, addDecoratorInfo);

    // Add decorator info to serialized json
    app.serializer.addSerializer({
        priority: 0,
        supports(item) {
            return item instanceof td.DeclarationReflection;
        },
        toObject(item, obj, _ser) {
            if (item.decorators) {
                obj.decorators = item.decorators;
            }
            return obj;
        },
    });
};

function addDecoratorInfo(context, decl) {
    const symbol = context.project.getSymbolFromReflection(decl);
    if (!symbol) return;

    const declaration = symbol.valueDeclaration;
    if (!declaration) return;
    if (!ts.isPropertyDeclaration(declaration) && !ts.isMethodDeclaration(declaration)) {
        return;
    }

    const decorators = declaration.modifiers?.filter(ts.isDecorator);
    if (!decorators || decorators.length === 0) return;

    const t = decorators[0].expression.expression;
    decl.decorators = decorators.map((d) => ({
        name: t.expression.escapedText + '.' + t.name.escapedText,
        // TODO: Parse default value from arguments
    }));
}
